/* ============================================================
   store.js — persistence and shared helpers
   Sessions and periodization overrides live in localStorage.
   Board diagrams are stored as vector objects, not PNG, so the
   5 MB localStorage ceiling is never the binding constraint.
   PNG is rendered only on export and print.
   ============================================================ */
(function (w) {
  'use strict';

  var K_SESS = 'ncfc.sessions.v1';
  var K_PLAN = 'ncfc.plan.v1';
  var K_PREF = 'ncfc.prefs.v1';
  var K_CUSTOM = 'ncfc.plans.v1';

  function read(k, fb) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
    catch (e) { console.warn('read failed', k, e); return fb; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) {
      toast(e && e.name === 'QuotaExceededError'
        ? 'Storage is full. Export a backup, then delete old sessions.'
        : 'Could not save to this browser.');
      return false;
    }
  }

  /* ---------- sessions ----------
     Two tiers. Local sessions live in this browser and are editable.
     Library sessions ship inside the deployment (js/data.sessions.js) and are
     read-only, which is how a session reaches a second device on a static host. */
  function librarySessions() {
    var lib = (w.LIBRARY && w.LIBRARY.sessions) || {};
    var out = {};
    Object.keys(lib).forEach(function (k) {
      out[k] = Object.assign({}, lib[k], { id: k, library: true });
    });
    return out;
  }
  function allSessions() { return read(K_SESS, {}); }
  function everySession() {
    var lib = librarySessions(), mine = allSessions(), out = {};
    Object.keys(lib).forEach(function (k) { out[k] = lib[k]; });
    Object.keys(mine).forEach(function (k) { out[k] = mine[k]; });   // local wins on a clash
    return out;
  }
  function getSession(id) { return everySession()[id] || null; }
  function saveSession(s) {
    var all = allSessions();
    s.updated = new Date().toISOString();
    /* a record that has never been submitted is a draft, whatever wrote it */
    if (s.status !== 'complete') { s.status = 'draft'; delete s.submittedAt; }
    all[s.id] = s;
    return write(K_SESS, all) ? s : null;
  }

  /* ---------- session status ----------
     A session has two states and nothing in between. Saving and autosaving
     leave it in draft; only the coach pressing Submit makes it complete.
     A prescription typed on a periodization row is not a session at all, so
     a session started from one counts as written only once it is submitted.
     Records written before this existed carry no status, so they are drafts. */
  function sessionStatus(s) { return s && s.status === 'complete' ? 'complete' : 'draft'; }
  function isComplete(s) { return sessionStatus(s) === 'complete'; }
  function isDraft(s) { return !!s && !isComplete(s); }
  function statusLabel(s) { return isComplete(s) ? 'Complete' : 'Draft'; }
  function statusChip(s) { return isComplete(s) ? 'ao' : 'off'; }
  function submitSession(id) {
    var s = getSession(id);
    if (!s || s.library) return null;
    s.status = 'complete';
    s.submittedAt = new Date().toISOString();
    var all = allSessions();
    all[s.id] = s;
    return write(K_SESS, all) ? s : null;
  }
  function unsubmitSession(id) {
    var s = getSession(id);
    if (!s || s.library) return null;
    s.status = 'draft';
    delete s.submittedAt;
    return saveSession(s);
  }
  /* how many sessions a plan can claim, split by state */
  function sessionTally(planId, includeArchived) {
    var out = { complete: 0, draft: 0, total: 0 };
    sessionList(includeArchived).forEach(function (s) {
      if (planId && s.squad !== planId) return;
      out.total++;
      if (isComplete(s)) out.complete++; else out.draft++;
    });
    return out;
  }
  /* "3 sessions written · 2 in draft", or '' when there is nothing to say */
  function tallyWords(planId) {
    var t = sessionTally(planId);
    var bits = [t.complete + ' session' + (t.complete === 1 ? '' : 's') + ' written'];
    if (t.draft) bits.push(t.draft + ' in draft');
    return bits.join(' \u00b7 ');
  }
  function deleteSession(id) { var a = allSessions(); delete a[id]; write(K_SESS, a); }
  function sessionList(includeArchived) {
    var a = everySession(), out = [];
    for (var k in a) if (a.hasOwnProperty(k)) out.push(a[k]);
    /* a session on an archived season stays on disk but leaves the lists */
    if (!includeArchived) out = out.filter(function (s2) { return !isArchived(s2.squad); });
    out.sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); });
    return out;
  }
  function sessionsOn(date, squad) {
    return sessionList().filter(function (s) {
      return s.date === date && (!squad || s.squad === squad);
    });
  }
  function newId() {
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  /* Build the deployable library file from whatever is in this browser. */
  function libraryFile(ids) {
    var mine = allSessions(), pick = {};
    (ids && ids.length ? ids : Object.keys(mine)).forEach(function (k) {
      if (mine[k]) pick[k] = mine[k];
    });
    var lib = librarySessions();
    Object.keys(lib).forEach(function (k) {
      if (!pick[k]) { var c = Object.assign({}, lib[k]); delete c.library; pick[k] = c; }
    });
    return '/* Session library that ships with the site.\n' +
      '   Regenerate from the planner: Export > Publish library file,\n' +
      '   drop it back into js/, redeploy. Library sessions are read-only. */\n' +
      'window.LIBRARY = ' + JSON.stringify({ published: new Date().toISOString(), sessions: pick }, null, 1) + ';\n';
  }
  function libraryCount() { return Object.keys(librarySessions()).length; }

  /* ---------- periodization overrides ---------- */
  /* key: squad|date  ->  { event,duration,rpe,moment,phase,principle,focus,pa1,pa2,notes,off } */
  function plan() { return read(K_PLAN, {}); }
  function planKey(squad, date) { return squad + '|' + date; }
  function getPlan(squad, date) { return plan()[planKey(squad, date)] || {}; }
  function setPlan(squad, date, patch) {
    var p = plan(), k = planKey(squad, date);
    p[k] = Object.assign({}, p[k] || {}, patch);
    write(K_PLAN, p);
    /* an event change moves GD on every day around it, so the rows are rebuilt */
    if (patch && patch.event != null) delete rowCache[squad];
    return p[k];
  }

  /* ---------- prefs ---------- */
  function prefs() { return read(K_PREF, { coach: 'Alex Edwards', squad: 'U13' }); }
  function setPref(k, v) { var p = prefs(); p[k] = v; write(K_PREF, p); return p; }

  /* ---------- plans ----------
     A plan is a calendar config. The two squads ship built in; anything
     the coach creates lives alongside them and behaves identically. */
  function customPlans() { return read(K_CUSTOM, {}); }
  function builtinPlans() { return (w.SEASON && w.SEASON.plans) || []; }

  /* An archived season stays whole: its calendar, sessions and sheets are all
     still there. It just stops appearing in the switchers. */
  var K_ARCH = 'ncfc.archived.v1';
  function archivedIds() {
    try { return JSON.parse(localStorage.getItem(K_ARCH) || '[]'); } catch (e) { return []; }
  }
  function archivePlan(id, on) {
    /* an id set rather than a flag on the config, so a built-in plan can be
       archived without being copied first */
    var list = archivedIds();
    var i = list.indexOf(id);
    if (on && i < 0) list.push(id);
    if (!on && i >= 0) list.splice(i, 1);
    try { localStorage.setItem(K_ARCH, JSON.stringify(list)); } catch (e) {}
    var c = planConfig(id);
    if (c && !c.builtin) { c.archived = !!on; savePlanConfig(c); }
    return id;
  }
  function isArchived(id) {
    if (archivedIds().indexOf(id) >= 0) return true;
    var c = planConfig(id);
    return !!(c && c.archived);
  }
  function planListAll() { return planList(true); }

  /* everything keyed to a plan, so archiving or deleting can say what goes */
  function planFootprint(id) {
    function count(key, test) {
      try {
        var d = JSON.parse(localStorage.getItem(key) || '{}');
        return Object.keys(d).filter(function (k) { return test(k, d[k]); }).length;
      } catch (e) { return 0; }
    }
    return {
      sessions: count('ncfc.sessions.v1', function (k, v) { return v && v.squad === id; }),
      players: (function () {
        try {
          var d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}');
          return Object.keys(d.players || {}).filter(function (k) { return d.players[k].plan === id; }).length;
        } catch (e) { return 0; }
      })(),
      sheets: count('ncfc.lineups.v1', function (k, v) { return v && v.plan === id; }),
      edits: count('ncfc.plan.v1', function (k) { return k.indexOf(id + '|') === 0; }),
      feedback: count('ncfc.feedback.v1', function (k) { return k.indexOf(id + '|') === 0; }),
      cycles: count('ncfc.cycles.v1', function (k) { return k.indexOf(id + '|') === 0; })
    };
  }
  function footprintWords(id) {
    var f = planFootprint(id);
    var bits = [];
    if (f.sessions) bits.push(f.sessions + ' session' + (f.sessions === 1 ? '' : 's'));
    if (f.players) bits.push(f.players + ' player' + (f.players === 1 ? '' : 's'));
    if (f.sheets) bits.push(f.sheets + ' team sheet' + (f.sheets === 1 ? '' : 's'));
    if (f.edits) bits.push(f.edits + ' edited day' + (f.edits === 1 ? '' : 's'));
    if (f.feedback) bits.push(f.feedback + ' feedback poll' + (f.feedback === 1 ? '' : 's'));
    if (f.cycles) bits.push(f.cycles + ' cycle' + (f.cycles === 1 ? '' : 's'));
    return bits.join(', ');
  }

  /* A new season carrying the same squad: the roster, the coaches and the
     settings come across; sessions, fixtures and marks do not, because they
     belonged to last year. */
  function newSeasonFrom(id, label, start, end) {
    var src = planConfig(id);
    if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = newPlanId();
    copy.builtin = false;
    copy.archived = false;
    copy.label = label || (src.label + ' (new season)');
    copy.short = (label || copy.label).split(/[,(]/)[0].trim().slice(0, 18);
    if (start) copy.start = start;
    if (end) copy.end = end;
    copy.fixtures = [];
    savePlanConfig(copy);

    try {
      var d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}');
      d.players = d.players || {};
      var moved = 0;
      Object.keys(d.players).forEach(function (k) {
        var pl = d.players[k];
        if (pl.plan !== id) return;
        var nid = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        d.players[nid] = Object.assign({}, pl, { id: nid, plan: copy.id, ranks: {} });
        moved++;
      });
      localStorage.setItem('ncfc.idp.v1', JSON.stringify(d));
      copy.carried = moved;
    } catch (e) {}
    return copy;
  }

  function planList(includeArchived) {
    var arch = archivedIds();
    var out = builtinPlans().map(function (p) {
      return { id: p.id, label: p.label, short: p.short || p.id, builtin: true,
        archived: arch.indexOf(p.id) >= 0 };
    });
    var c = customPlans();
    Object.keys(c).forEach(function (k) {
      out.push({ id: k, label: c[k].label || k, short: c[k].short || c[k].label || k,
        builtin: false, archived: !!c[k].archived || arch.indexOf(k) >= 0 });
    });
    return includeArchived ? out : out.filter(function (p) { return !p.archived; });
  }
  function planConfig(id) {
    var b = builtinPlans().filter(function (p) { return p.id === id; })[0];
    return b || customPlans()[id] || null;
  }
  function planLabel(id) {
    var p = planList().filter(function (x) { return x.id === id; })[0];
    return p ? p.short : id;
  }
  function planExists(id) { return !!planConfig(id); }
  function defaultPlanId() {
    var pref = prefs().squad;
    if (pref && planExists(pref)) return pref;
    var l = planList();
    return l.length ? l[0].id : '';
  }
  function newPlanId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function savePlanConfig(cfg) {
    if (!cfg.id) cfg.id = newPlanId();
    var c = customPlans();
    c[cfg.id] = cfg;
    if (!write(K_CUSTOM, c)) return null;
    rowCache = {};
    return cfg;
  }
  function deletePlanConfig(id, alsoSessions) {
    var c = customPlans();
    delete c[id];
    write(K_CUSTOM, c);
    clearPlanEdits(id);
    if (alsoSessions) clearSessions(id);
    rowCache = {};
  }
  function planCoaches(id) {
    var c = planConfig(id);
    return (c && c.coaches) || [];
  }
  function setPlanCoaches(id, list) {
    var c = planConfig(id);
    if (!c) return false;
    if (c.builtin) {                       // a built-in plan is copied before it is altered
      var copy = JSON.parse(JSON.stringify(c));
      copy.id = newPlanId(); copy.builtin = false; copy.coaches = list;
      savePlanConfig(copy);
      return copy.id;
    }
    c.coaches = list;
    savePlanConfig(c);
    return id;
  }

  function duplicatePlan(id, label) {
    var src = planConfig(id);
    if (!src) return null;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = newPlanId();
    copy.builtin = false;
    copy.label = label || (src.label + ' copy');
    copy.short = copy.label;
    return savePlanConfig(copy);
  }

  /* ---------- season lookups ---------- */
  var rowCache = {};
  function planRows(id) {
    if (rowCache[id]) return rowCache[id];
    var cfg = planConfig(id);
    if (!cfg || !w.SeasonGen) return [];
    var rows = w.SeasonGen.build(cfg);
    rowCache[id] = regd(id, rows);
    return rowCache[id];
  }

  /* GD is proximity to a game, so it has to follow what the rows actually say.
     Turning a Tuesday into a game, or cancelling a Saturday, moves GD on every
     day around it; the generated value only knew about the fixture list. */
  function regd(id, rows) {
    var all = plan();
    var games = [];
    function ev(date, fallback) {
      var k = id + '|' + date;
      return (all[k] && all[k].event) || fallback;
    }
    rows.forEach(function (r) {
      var e = ev(r.date, r.event);
      var isGame = e.indexOf('Game') === 0 && e !== 'Game Cancelled';
      if (isGame) games.push(r.date);
    });
    if (!games.length) {
      rows.forEach(function (r) { r.gd = ''; });
      return rows;
    }
    function toD(iso) { return new Date(iso + 'T12:00:00'); }
    function days(a, b) { return Math.round((toD(b) - toD(a)) / 86400000); }
    rows.forEach(function (r) {
      var e = ev(r.date, r.event);
      if (e.indexOf('Game') === 0 && e !== 'Game Cancelled') { r.gd = 'Game'; return; }
      var prev = null, next = null;
      games.forEach(function (g) {
        if (g < r.date) prev = g;
        if (g > r.date && next === null) next = g;
      });
      var a = prev ? days(prev, r.date) : 999;
      var b = next ? days(r.date, next) : 999;
      if (b <= a && b < 999) r.gd = 'GD-' + b;
      else if (a < 999) r.gd = 'GD+' + a;
      else r.gd = '';
    });
    return rows;
  }
  function planBlocks(id) {
    var cfg = planConfig(id);
    return (cfg && cfg.blocks) || [];
  }
  function day(squad, date) {
    var rows = planRows(squad);
    for (var i = 0; i < rows.length; i++) if (rows[i].date === date) return rows[i];
    return null;
  }
  /* season row merged with the coach's overrides */
  function dayMerged(squad, date) {
    var base = day(squad, date);
    if (!base) return null;
    return Object.assign({}, base, getPlan(squad, date));
  }
  function days(squad) {
    return planRows(squad).map(function (r) { return Object.assign({}, r, getPlan(squad, r.date)); });
  }

  /* ---------- clearing ----------
     Three separate scopes, because they fail in different ways.
     Nothing here touches a plan config unless asked. */
  function clearPlanEdits(planId) {
    if (!planId) { write(K_PLAN, {}); return 0; }
    var p = plan(), n = 0;
    Object.keys(p).forEach(function (k) {
      if (k.indexOf(planId + '|') === 0) { delete p[k]; n++; }
    });
    write(K_PLAN, p);
    return n;
  }
  function clearSessions(planId) {
    var all = allSessions(), n = 0;
    Object.keys(all).forEach(function (k) {
      if (!planId || all[k].squad === planId) { delete all[k]; n++; }
    });
    write(K_SESS, all);
    return n;
  }
  function countFor(planId) {
    var p = plan(), edits = 0;
    Object.keys(p).forEach(function (k) { if (!planId || k.indexOf(planId + '|') === 0) edits++; });
    var sess = sessionList().filter(function (s) { return !planId || s.squad === planId; }).length;
    return { edits: edits, sessions: sess };
  }
  function resetAll() {
    [K_SESS, K_PLAN, K_CUSTOM].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    rowCache = {};
  }
  function nextTraining(squad, from) {
    var f = from || todayISO();
    var rows = days(squad);
    for (var i = 0; i < rows.length; i++)
      if (rows[i].date >= f && rows[i].event === 'Training Session') return rows[i];
    return null;
  }
  function nextGame(squad, from) {
    var f = from || todayISO();
    var rows = days(squad);
    for (var i = 0; i < rows.length; i++)
      if (rows[i].date >= f && rows[i].event.indexOf('Game') === 0) return rows[i];
    return null;
  }

  /* ---------- principles ---------- */
  function principle(code) {
    var p = w.PRINCIPLES || [];
    for (var i = 0; i < p.length; i++) if (p[i].code === code) return p[i];
    return null;
  }
  var MOMENT_KEY = {
    'Attacking Organization': 'ao', 'Defensive Organization': 'do',
    'Attacking Transition': 'at', 'Defensive Transition': 'dt'
  };
  function momentKey(m) { return MOMENT_KEY[m] || 'do'; }

  /* ---------- dates ---------- */
  function todayISO() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function fmt(iso) {
    if (!iso) return '';
    var b = iso.split('-');
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (+b[2]) + ' ' + M[+b[1] - 1];
  }
  function dow(iso) {
    var d = new Date(iso + 'T12:00:00');
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  }

  /* ---------- files ---------- */
  /* One chooser for every export. A table can leave as a spreadsheet, a
     document or structured data, and the same rows build all three. */
  function toHTMLTable(title, rows) {
    var esc2 = esc;
    return '<!doctype html><meta charset="utf-8"><title>' + esc2(title) + '</title>' +
      '<style>body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;margin:24px}' +
      'h1{font-size:15pt}table{border-collapse:collapse;width:100%;font-size:9.5pt}' +
      'th{background:#143250;color:#fff;text-align:left}th,td{border:1px solid #999;padding:4px 6px;vertical-align:top}' +
      'tr:nth-child(even) td{background:#f6f7f6}</style>' +
      '<h1>' + esc2(title) + '</h1><table>' +
      rows.map(function (r, i) {
        var tag = i ? 'td' : 'th';
        return '<tr>' + r.map(function (c) {
          return '<' + tag + '>' + esc2(c == null ? '' : String(c)).replace(/\n/g, '<br>') + '</' + tag + '>';
        }).join('') + '</tr>';
      }).join('') + '</table>';
  }
  function rowsToObjects(rows) {
    var head = rows[0] || [];
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
  }
  function exportAs(base, rows, opts) {
    opts = opts || {};
    var safe = base.replace(/[^\w-]+/g, '_');
    var choices = [
      ['csv', 'Spreadsheet (.csv)', 'Opens in Excel or Numbers'],
      ['html', 'Document (.html)', 'A formatted table; open it in Word to save as .docx'],
      ['json', 'Data (.json)', 'For another tool, or to import somewhere else']
    ];
    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var card = el('div', { class: 'card', style: 'max-width:440px;width:100%' });
    card.appendChild(el('div', { class: 'card-hd' }, [el('h2', { text: 'Export ' + base })]));
    var bd = el('div', { class: 'card-bd' });
    bd.appendChild(el('p', { class: 'hint', style: 'margin:0 0 12px',
      text: (rows.length - 1) + ' row' + (rows.length === 2 ? '' : 's') + '. Pick a format.' }));
    choices.forEach(function (c) {
      var b = el('button', { class: 'tile', type: 'button', style: 'width:100%;margin-bottom:8px;flex-direction:column;align-items:flex-start;gap:2px' }, [
        el('b', { text: c[1] }), el('span', { class: 'hint', text: c[2] })
      ]);
      b.addEventListener('click', function () {
        back.remove();
        if (c[0] === 'csv') download(safe + '.csv', toCSV(rows), 'text/csv');
        else if (c[0] === 'html') download(safe + '.html', toHTMLTable(opts.title || base, rows), 'text/html');
        else download(safe + '.json', JSON.stringify(opts.json || rowsToObjects(rows), null, 1), 'application/json');
      });
      bd.appendChild(b);
    });
    bd.appendChild(el('button', { class: 'btn ghost sm', text: 'Cancel', onclick: function () { back.remove(); } }));
    card.appendChild(bd); back.appendChild(card);
    document.body.appendChild(back);
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }
  function pickFile(accept, cb) {
    var i = document.createElement('input');
    i.type = 'file'; i.accept = accept || '.json';
    i.onchange = function () {
      var f = i.files && i.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { cb(r.result, f.name); };
      r.readAsText(f);
    };
    i.click();
  }
  function csvCell(v) {
    v = (v == null ? '' : String(v));
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function toCSV(rows) {
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  /* ---------- toast ---------- */
  var tEl, tT;
  function toast(msg) {
    if (!tEl) { tEl = document.createElement('div'); tEl.className = 'toast'; document.body.appendChild(tEl); }
    tEl.textContent = msg; tEl.classList.add('on');
    clearTimeout(tT); tT = setTimeout(function () { tEl.classList.remove('on'); }, 2600);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  w.Store = {
    allSessions: allSessions, everySession: everySession, librarySessions: librarySessions,
    libraryFile: libraryFile, libraryCount: libraryCount,
    getSession: getSession, saveSession: saveSession,
    deleteSession: deleteSession, sessionList: sessionList, sessionsOn: sessionsOn, newId: newId,
    sessionStatus: sessionStatus, isComplete: isComplete, isDraft: isDraft,
    statusLabel: statusLabel, statusChip: statusChip,
    submitSession: submitSession, unsubmitSession: unsubmitSession,
    sessionTally: sessionTally, tallyWords: tallyWords,
    plan: plan, getPlan: getPlan, setPlan: setPlan,
    prefs: prefs, setPref: setPref,
    day: day, dayMerged: dayMerged, days: days, nextTraining: nextTraining, nextGame: nextGame,
    planList: planList, planConfig: planConfig, planLabel: planLabel, planExists: planExists,
    defaultPlanId: defaultPlanId, newPlanId: newPlanId, savePlanConfig: savePlanConfig,
    deletePlanConfig: deletePlanConfig, duplicatePlan: duplicatePlan,
    planRows: planRows, planBlocks: planBlocks, customPlans: customPlans,
    planCoaches: planCoaches, setPlanCoaches: setPlanCoaches,
    archivePlan: archivePlan, isArchived: isArchived, planListAll: planListAll,
    planFootprint: planFootprint, footprintWords: footprintWords, newSeasonFrom: newSeasonFrom,
    clearPlanEdits: clearPlanEdits, clearSessions: clearSessions, countFor: countFor, resetAll: resetAll,
    principle: principle, momentKey: momentKey,
    todayISO: todayISO, fmt: fmt, dow: dow,
    download: download, exportAs: exportAs, toHTMLTable: toHTMLTable, pickFile: pickFile, toCSV: toCSV,
    toast: toast, esc: esc, el: el,
    K_SESS: K_SESS, K_PLAN: K_PLAN, K_CUSTOM: K_CUSTOM
  };
})(window);

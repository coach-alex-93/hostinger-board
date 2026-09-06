/* ============================================================
   gallery.js — IPM 1 gallery observation sheet
   Standalone records, because the coach observed is often not you.
   Linking one of your own sessions fills the left column from it.
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el, esc = S.esc;
  var K = 'ncfc.gallery.v1';

  function TICKS() {
    return (window.Lists ? window.Lists.get('designTicks') : null) ||
      (window.CLUB && window.CLUB.designTicks) || [];
  }

  var CONTEXT = [
    { k: 'sessionObjective', label: 'Session objective', rows: 3 },
    { k: 'activityObjective', label: 'Activity objective', rows: 3 },
    { k: 'igs', label: 'Identified game situation (IGS) and connected game model principle', rows: 3 },
    { k: 'strategy', label: 'Connection to strategy and prioritized learning plan (individual player influence)', rows: 3 },
    { k: 'instances', label: 'Instance(s) identified', rows: 3 }
  ];

  var FIELDS = ['coachObserved', 'observer', 'date', 'ageGroup', 'field', 'setting', 'link',
    'evidence', 'behavior', 'coaching', 'design', 'takeaway'];

  var current = null, dirty = false;

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(K, JSON.stringify(d)); return true; }
    catch (e) { S.toast('Could not save the sheet.'); return false; }
  }
  function all() {
    var d = read(), out = [];
    Object.keys(d).forEach(function (k) { out.push(d[k]); });
    out.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return out;
  }

  function blank() {
    var p = S.prefs();
    return {
      id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      coachObserved: '', observer: p.coach || '', date: S.todayISO(), ageGroup: '', field: '',
      setting: '', link: '', ticks: [], evidence: '', context: {},
      behavior: '', coaching: '', design: '', takeaway: '', log: [], logMeta: { length: 0, ended: false }
    };
  }

  /* ---------- derive the left column from a linked session ---------- */
  function slotLabel(k) {
    var sl = ((window.CLUB && window.CLUB.slots) || []).filter(function (x) { return x.key === k; })[0];
    if (sl) return sl.label;
    var m = /^a(\d+)$/.exec(k || '');
    return m ? 'Activity ' + m[1] : 'Activity';
  }
  /* This page reads sessions straight from the store, so it can meet one
     written when the first slot was the warm-up. The planner renumbers those
     positionally the moment it opens them, so the same rule is applied here
     and the two always agree on which activity is which. */
  function actNames(acts) {
    var legacy = (acts || []).some(function (a) { return a.slot === 'warmup' || a.kind === 'warmup'; });
    return (acts || []).map(function (a, i) {
      return a.label || (legacy ? 'Activity ' + (i + 1) : slotLabel(a.slot));
    });
  }
  function derived(key) {
    var s = current.link ? S.getSession(current.link) : null;
    if (!s) return '';
    var p = S.principle(s.principleCode);
    var pLabel = p ? '[' + p.clubCode + '] ' + (p.clubName || p.name) : (s.principleCode || '');
    switch (key) {
      case 'sessionObjective': return [s.cycleObj, s.focus].filter(Boolean).join('\n');
      case 'activityObjective':
        var aNames = actNames(s.acts);
        return (s.acts || []).map(function (a, i) {
          return aNames[i] + (a.type ? ' (' + a.type + ')' : '');
        }).join('\n');
      case 'igs': return [s.igs, pLabel, s.cue ? 'Cue: ' + s.cue : ''].filter(Boolean).join('\n');
      case 'strategy': return [s.strategy, s.learningPlan].filter(Boolean).join('\n');
      case 'instances': return s.instances || '';
    }
    return '';
  }

  /* ---------- render ---------- */
  function renderTicks() {
    var host = document.getElementById('ticks');
    host.innerHTML = '';
    var box = el('div', { class: 'subs', style: 'max-height:none' });
    TICKS().forEach(function (t) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = (current.ticks || []).indexOf(t) >= 0;
      cb.addEventListener('change', function () {
        current.ticks = current.ticks || [];
        var i = current.ticks.indexOf(t);
        if (cb.checked && i < 0) current.ticks.push(t);
        if (!cb.checked && i >= 0) current.ticks.splice(i, 1);
        mark();
      });
      box.appendChild(el('label', {}, [cb, el('span', { text: t }),
        window.Lists.removeBtn('designTicks', t, function () {
          current.ticks = (current.ticks || []).filter(function (x) { return x !== t; });
          renderTicks(); mark();
        })]));
    });
    host.appendChild(box);
    host.appendChild(el('button', {
      class: 'btn ghost sm no-print', style: 'margin-top:6px;width:100%;justify-content:center',
      text: '+ Add a tickbox',
      onclick: function () {
        var v = prompt('New teaching plan tickbox');
        if (!v) return;
        window.Lists.add('designTicks', v);
        current.ticks = (current.ticks || []).concat([v.trim()]);
        renderTicks(); mark();
        S.toast('Added. It is on every observation sheet from now on.');
      }
    }));
  }

  var logView = null;

  function roster() {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    var s = current.link ? S.getSession(current.link) : null;
    var out = [];
    Object.keys(d.players || {}).forEach(function (k) {
      if (!s || d.players[k].plan === s.squad) out.push(d.players[k]);
    });
    out.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return out;
  }

  function renderLog() {
    var host = document.getElementById('ivlog');
    if (!host || !window.IntervLog) return;
    current.log = current.log || [];
    current.logMeta = current.logMeta || { length: 0, ended: false };
    logView = window.IntervLog.mount(host, current.log,
      { roster: roster(), meta: current.logMeta, onChange: mark });
  }

  function renderContext() {
    var host = document.getElementById('context');
    host.innerHTML = '';
    current.context = current.context || {};
    CONTEXT.forEach(function (spec) {
      var d = derived(spec.k);
      var t = el('textarea', { rows: spec.rows, placeholder: d ? 'Filled from the linked session' : '' });
      t.value = current.context[spec.k] || d || '';
      t.addEventListener('input', function () { current.context[spec.k] = t.value; mark(); });
      var lab = el('label', { class: 'f' }, [el('span', { text: spec.label }), t]);
      if (d && !current.context[spec.k]) {
        lab.appendChild(el('p', { class: 'hint', style: 'margin:4px 0 0;font-size:11px',
          text: 'From the linked session. Type over it to make it yours.' }));
      }
      host.appendChild(lab);
    });
  }

  function fillLink() {
    var sel = document.getElementById('f_link');
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '', text: 'Not one of mine' }));
    S.sessionList().forEach(function (s) {
      var p = S.principle(s.principleCode);
      sel.appendChild(el('option', { value: s.id,
        text: S.fmt(s.date) + ' ' + S.planLabel(s.squad) + (p ? ' · ' + p.clubCode : '') }));
    });
    sel.value = current.link || '';
  }

  function fillList() {
    var sel = document.getElementById('obsSel');
    sel.innerHTML = '';
    var list = all();
    if (!list.length) { sel.appendChild(el('option', { value: '', text: 'No sheets yet' })); return; }
    list.forEach(function (o) {
      sel.appendChild(el('option', { value: o.id,
        text: S.fmt(o.date) + ' · ' + (o.coachObserved || 'unnamed coach') +
          (o.setting ? ' · ' + o.setting : '') + (o.ageGroup ? ' · ' + o.ageGroup : '') }));
    });
    sel.value = current.id;
  }

  function toForm() {
    FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (n && k !== 'link') n.value = current[k] == null ? '' : current[k];
    });
    fillLink();
    renderTicks();
    renderContext();
    renderLog();
    fillList();
  }

  function mark() { dirty = true; document.getElementById('saveState').textContent = 'Unsaved sheet'; }
  function clean(t) { dirty = false; document.getElementById('saveState').textContent = t || 'Sheet saved'; }

  function save() {
    var d = read();
    d[current.id] = current;
    if (!write(d)) return;
    clean(); fillList();
  }
  function load(id) {
    var d = read();
    current = d[id] ? JSON.parse(JSON.stringify(d[id])) : blank();
    toForm(); clean(d[id] ? 'Opened' : 'New sheet');
  }

  /* ---------- export ---------- */
  function csv() {
    var rows = [['Date', 'Coach observed', 'Observer', 'Setting', 'Age group', 'Field / station', 'Ticked']
      .concat(CONTEXT.map(function (c) { return c.label; }))
      .concat(['Evidence', 'Player behavior observed', 'Coach interaction and influence',
        'Activity design influence', 'Taking into my own coaching'])];
    all().forEach(function (o) {
      var keep = current; current = o;
      rows.push([o.date, o.coachObserved || '', o.observer || '', o.setting || '', o.ageGroup || '', o.field || '',
        (o.ticks || []).join(' · ')]
        .concat(CONTEXT.map(function (c) { return (o.context || {})[c.k] || derived(c.k); }))
        .concat([o.evidence || '', o.behavior || '', o.coaching || '', o.design || '', o.takeaway || '']));
      current = keep;
    });
    if (rows.length === 1) { S.toast('No sheets to export yet.'); return; }
    S.exportAs('Coach_observations', rows);

    var log = [['Date', 'Coach observed', 'Setting', 'Session length (mm:ss)', 'At (mm:ss)', 'At (seconds)',
      'Lasted (m:ss)', 'Lasted (sec)', 'Who', 'When', 'How', 'Other', 'Pitch x', 'Pitch y', 'Note']];
    all().forEach(function (o) {
      (o.log || []).forEach(function (e) {
        log.push([o.date, o.coachObserved || '', o.setting || '',
          window.IntervLog.mmss((o.logMeta || {}).length || 0),
          window.IntervLog.mmss(e.t), e.t, window.IntervLog.fmtDur(e.dur), e.dur || '', e.who || '', window.IntervLog.asText(e.when), window.IntervLog.asText(e.how), window.IntervLog.asText(e.other),
          e.x == null ? '' : e.x, e.y == null ? '' : e.y, e.note || '']);
      });
    });
    if (log.length > 1) S.exportAs('Coach_observation_interventions', log);
  }

  function buildPrint() {
    var hdr = [['Coach observed', current.coachObserved], ['Observer', current.observer],
      ['Date', S.fmt(current.date)], ['Age group', current.ageGroup], ['Field / station', current.field]];
    if (current.setting) hdr.push(['Setting', current.setting]);
    var html = '<h1 style="margin:0 0 2pt;font-size:15pt">Coach observation sheet</h1>' +
      '<p style="margin:0 0 8pt;font-size:9.5pt">Teaching plan and interactions</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:8pt"><tr>' +
      hdr.map(function (x) {
        return '<td style="padding:3pt;border:.5pt solid #999"><strong>' + esc(x[0]) + ':</strong> ' + esc(x[1] || '') + '</td>';
      }).join('') + '</tr></table>' +
      '<table style="width:100%;border-collapse:collapse;font-size:9pt"><tr>' +
      '<td style="width:50%;padding:5pt;border:.5pt solid #999;vertical-align:top">' +
      '<p style="margin:0 0 6pt">' + TICKS().map(function (t) {
        return ((current.ticks || []).indexOf(t) >= 0 ? '&#9745;' : '&#9744;') + ' ' + esc(t);
      }).join('&nbsp;&nbsp; ') + '</p>' +
      '<p style="margin:6pt 0 2pt"><strong>Evidence (why were these ticked?)</strong></p>' +
      '<p style="margin:0 0 6pt;white-space:pre-wrap;min-height:12mm">' + esc(current.evidence || '') + '</p>' +
      CONTEXT.map(function (c) {
        return '<p style="margin:6pt 0 2pt"><strong>' + esc(c.label) + '</strong></p>' +
          '<p style="margin:0;white-space:pre-wrap;min-height:10mm">' +
          esc((current.context || {})[c.k] || derived(c.k) || '') + '</p>';
      }).join('') +
      '</td><td style="width:50%;padding:5pt;border:.5pt solid #999;vertical-align:top">' +
      [['Record the player behavior observed in the instance(s) identified above.', current.behavior],
       ["Record how the coach interacted with and influenced the player's behavior during the session.", current.coaching],
       ["Record how activity design influenced the player's behavior and the coach's ability to impact that.", current.design],
       ['What I am taking into my own coaching.', current.takeaway]]
        .map(function (x) {
          return '<p style="margin:0 0 2pt"><strong>' + esc(x[0]) + '</strong></p>' +
            '<p style="margin:0 0 10pt;white-space:pre-wrap;min-height:26mm">' + esc(x[1] || '') + '</p>';
        }).join('') +
      '</td></tr></table>';

    if ((current.log || []).length) {
      var byWho = {};
      current.log.forEach(function (e) { if (e.who) byWho[e.who] = (byWho[e.who] || 0) + 1; });
      var span = Math.max.apply(null, current.log.map(function (e) { return e.t || 0; })) || 0;
      html += '<div style="page-break-inside:avoid;margin-top:10pt">' +
        '<p style="margin:0 0 4pt;font-weight:600;font-size:10pt">Timed coaching interventions</p>' +
        '<p style="margin:0 0 4pt;font-size:9pt">' + current.log.length + ' interventions over ' +
        esc(window.IntervLog.mmss((current.logMeta || {}).length || span)) +
        ((current.logMeta || {}).ended ? ' (session ended)' : ' (still open)') +
        ', across ' + Object.keys(byWho).length + ' recipients.</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:8.5pt">' +
        '<tr>' + ['At', 'Lasted', 'Who', 'When', 'How', 'Note'].map(function (x) {
          return '<th style="text-align:left;padding:2pt 4pt;border:.5pt solid #999">' + x + '</th>';
        }).join('') + '</tr>' +
        current.log.slice().sort(function (a, b) { return a.t - b.t; }).map(function (e) {
          return '<tr>' + [window.IntervLog.mmss(e.t), window.IntervLog.fmtDur(e.dur), e.who || '',
            window.IntervLog.asText(e.when), window.IntervLog.asText(e.how), e.note || ''].map(function (x) {
            return '<td style="padding:2pt 4pt;border:.5pt solid #999">' + esc(x) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</table></div>';
    }
    document.getElementById('printOnly').innerHTML = html;
    document.body.classList.add('has-printsheet');
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var list = all();
    current = list.length ? JSON.parse(JSON.stringify(list[0])) : blank();
    toForm(); clean(list.length ? 'Opened' : 'New sheet');

    FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (!n) return;
      n.addEventListener('input', function () { current[k] = n.value; mark(); });
      if (k === 'link') n.addEventListener('change', function () {
        current.link = n.value; renderContext(); renderLog(); mark();
      });
    });

    document.getElementById('obsSel').addEventListener('change', function () {
      if (dirty && !confirm('Switch sheet and lose the unsaved changes?')) { this.value = current.id; return; }
      load(this.value);
    });
    document.getElementById('btnNew').addEventListener('click', function () {
      if (dirty && !confirm('Start a new sheet and lose the unsaved changes?')) return;
      current = blank(); toForm(); clean('New sheet');
    });
    document.getElementById('btnDelete').addEventListener('click', function () {
      var d = read();
      if (!d[current.id]) { S.toast('This sheet has not been saved yet.'); return; }
      if (!confirm('Delete this observation sheet?')) return;
      delete d[current.id]; write(d);
      var rest = all();
      current = rest.length ? JSON.parse(JSON.stringify(rest[0])) : blank();
      toForm(); clean('Deleted');
    });
    document.getElementById('btnSave').addEventListener('click', save);
    document.getElementById('btnCsv').addEventListener('click', csv);
    document.getElementById('btnPrint').addEventListener('click', function () { buildPrint(); window.print(); });
    window.addEventListener('beforeprint', buildPrint);
    if (window.Autosave) window.Autosave.register({
      save: function () { save(); }, isDirty: function () { return dirty; }
    });
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });
  });
})();

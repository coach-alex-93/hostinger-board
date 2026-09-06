/* ============================================================
   planner.js
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el, esc = S.esc;

  var TEXT_FIELDS = ['coach', 'date', 'squad', 'duration', 'fp', 'gk', 'cogLoad', 'physLoad',
    'location', 'method', 'primaryPlayers', 'secondaryPlayers', 'availability',
    'cycleObj', 'igs', 'principleCode', 'moment', 'phase', 'focus', 'objectives',
    'strategy', 'learningPlan', 'instances', 'level', 'instanceName',
    'layer1', 'layer2', 'layer3', 'shapeIn', 'shapeOut', 'intentIn', 'intentOut', 'assign'];

  var MOMENTS = ['Attacking Organization', 'Defensive Organization', 'Attacking Transition', 'Defensive Transition'];
  var PHASES = {
    'Attacking Organization': ['Building', 'Attacking', 'Finishing'],
    'Defensive Organization': ['Impeding', 'Recovering', 'Protecting'],
    'Attacking Transition': ['Gaining Possession - Counter Attack', 'Gaining Possession - Secure Reorganize'],
    'Defensive Transition': ['Losing Possession - Counter-Press', 'Losing Possession - Reorganize']
  };
  var PA_SLOTS = 4;

  /* Three activities, numbered. There is no separate warm-up slot: an
     activity that warms them up is Activity 1 with a name on it, which is one
     fewer idea to explain and one fewer place for a diagram to go missing. */
  var SLOT_KEYS = ['a1', 'a2', 'a3'];
  var ACT_TEMPLATES = {
    a1: { kind: 'small', slot: 'a1', label: '', type: 'Game [Duel]',
      intro: '2', intervals: '4', time: '4', rest: '1', transition: '0' },
    a2: { kind: 'small', slot: 'a2', label: '', type: 'Game [Conditioned]',
      intro: '2', intervals: '2', time: '8', rest: '1.5', transition: '1' },
    a3: { kind: 'game', slot: 'a3', label: '', type: 'Game [Unrestricted]',
      intro: '1', intervals: '6', time: '2.5', rest: '1', transition: '1' }
  };
  var ACT_KEYS = ['label', 'kind', 'slot', 'type', 'description', 'areaSize', 'area', 'channel', 'numbers', 'load',
    'constraints', 'coachingPoints', 'pa', 'when', 'how', 'other',
    'intro', 'intervals', 'time', 'rest', 'transition', 'ttlDur', 'board', 'objective'];

  var session = blank();
  var board, currentBoard = 1, dirty = false;

  function blank() {
    var p = S.prefs();
    return {
      id: S.newId(), status: 'draft',
      coach: p.coach || 'Alex Edwards', date: S.todayISO(), squad: S.defaultPlanId(),
      duration: '75', fp: '', gk: '',
      cogLoad: '', physLoad: '', cycleObj: '', igs: '', principleCode: '', cue: '', moment: '', phase: '',
      location: '', method: '', primaryPlayers: '', secondaryPlayers: '', availability: '',
      focus: '', objectives: '', ready: {}, readyMode: 'player', pa: ['', '', '', ''],
      level: '', layer1: '', layer2: '', layer3: '',
      instanceName: '', components: [],
      shapeIn: '', shapeOut: '', intentIn: '', intentOut: '', assign: '', keyPlayers: [],
      subs: [], strategy: '', learningPlan: '', instances: '',
      acts: SLOT_KEYS.map(function (k, i) {
        return Object.assign({ pa: [], when: [], how: [], other: [], board: String(i + 1) }, ACT_TEMPLATES[k]);
      }),
      boardStates: { 1: { field: 'full', objects: [] }, 2: { field: 'full', objects: [] },
                     3: { field: 'full', objects: [] } }
    };
  }

  /* Sessions written when there was a separate warm-up slot carry slot
     'warmup' on their first activity. Numbering positionally keeps every
     activity that was written -- the old warm-up becomes Activity 1 -- and its
     diagram travels with it, because a diagram belongs to the activity and not
     to the slot it used to sit in. */
  function migrateActs(s) {
    if (!s || !Array.isArray(s.acts)) return s;
    var legacy = s.acts.some(function (a) { return a.slot === 'warmup' || a.kind === 'warmup'; });
    if (!legacy) return s;
    s.acts.forEach(function (a, i) {
      a.slot = 'a' + (i + 1);
      if (a.kind === 'warmup') a.kind = 'small';
    });
    return s;
  }

  /* ---------------- diagram ownership ----------------
     Every activity owns exactly one board state, so the printed sheet can put
     a diagram beside the activity it was drawn for. Two things used to break
     that: an activity arriving without a board id, and a board state left
     behind when its activity was removed. The orphan then printed at the end
     under "Other diagrams", which is where an uploaded picture kept turning
     up. An activity missing a board now adopts an orphan that has something on
     it before a blank one is made, and only a genuinely unclaimed diagram is
     still printed at the end. */
  function orphanBoards() {
    return Object.keys(session.boardStates || {}).filter(function (k) {
      return !session.acts.some(function (a) { return String(a.board) === String(k); });
    });
  }
  function hasContent(st) {
    return !!(st && ((st.objects && st.objects.length) || st.frame));
  }
  function allBoardStates() {
    return Object.keys(session.boardStates || {}).map(function (k) { return session.boardStates[k]; });
  }
  function normalizeBoards() {
    if (!session.boardStates) session.boardStates = {};
    var taken = {}, needy = [];
    session.acts.forEach(function (a) {
      var id = a.board == null ? '' : String(a.board);
      if (id && session.boardStates[id] && !taken[id]) { a.board = id; taken[id] = true; return; }
      needy.push(a);
    });
    needy.forEach(function (a) {
      var adopt = Object.keys(session.boardStates)
        .filter(function (k) { return !taken[k] && hasContent(session.boardStates[k]); })
        .sort(function (x, y) { return +x - +y; })[0];
      if (adopt) { a.board = String(adopt); taken[adopt] = true; return; }
      var n = 1;
      while (taken[String(n)]) n++;
      if (!session.boardStates[n]) session.boardStates[n] = { field: 'full', objects: [] };
      a.board = String(n);
      taken[String(n)] = true;
    });
    /* an empty board nobody owns is noise, not work */
    orphanBoards().forEach(function (k) {
      if (!hasContent(session.boardStates[k])) delete session.boardStates[k];
    });
  }

  /* ---------------- load maths ----------------
     total = work x sets + within-set rest x sets + between-set rest x (sets - 1)
     Matches every activity in the IPM1 export. */
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  /* Ball rolling time = intervals x time.
     Total = intro + intervals x (time + rest) + transition.
     Both reproduce every activity on the SessionTemplate sheet exactly. */
  function brt(a) { return num(a.intervals) * num(a.time); }
  /* Three intervals have two rests between them, not three. The last gap is the
     transition, which is usually longer because the next activity is being set up.
     This is a deliberate departure from the SessionTemplate, which counted a rest
     after the final interval. */
  function autoTotal(a) {
    var iv = Math.max(0, num(a.intervals));
    var rests = Math.max(0, iv - 1);
    return num(a.intro) + iv * num(a.time) + rests * num(a.rest) + num(a.transition);
  }
  function sessionBRT() { return session.acts.reduce(function (t, a) { return t + brt(a); }, 0); }
  function actTotal(a) {
    var t = num(a.ttlDur);
    return t > 0 ? t : autoTotal(a);
  }
  function sessionTotal() {
    return session.acts.reduce(function (s, a) { return s + actTotal(a); }, 0);
  }

  /* ---------------- ribbon ---------------- */
  function drawRibbon() {
    var track = document.getElementById('ribbon');
    var booked = num(session.duration) || 0;
    var total = sessionTotal();
    var scale = Math.max(booked, total) || 1;
    track.innerHTML = '';

    var MK = { small: 'var(--navy)', game: 'var(--flag)' };
    session.acts.forEach(function (a, i) {
      var t = actTotal(a);
      if (t <= 0) return;
      var seg = el('div', { class: 'ribbon-seg', style: 'flex:' + t + ' 1 0;background:' + (MK[a.kind] || 'var(--navy-2)') });
      seg.appendChild(el('b', { text: (a.label || 'Activity ' + (i + 1)).replace(/^Activity \d+ — /, '') }));
      seg.appendChild(el('i', { text: t + ' min' }));
      seg.title = (a.label || '') + ' — ' + t + ' min';
      track.appendChild(seg);
    });

    if (total < booked) {
      var free = booked - total;
      var f = el('div', { class: 'ribbon-seg rest', style: 'flex:' + free + ' 1 0;color:var(--slate)' });
      f.appendChild(el('b', { text: 'Unallocated' }));
      f.appendChild(el('i', { text: Math.round(free) + ' min' }));
      track.appendChild(f);
    } else if (total > booked && booked > 0) {
      var over = total - booked;
      var o = el('div', { class: 'ribbon-seg over', style: 'flex:' + over + ' 1 0' });
      o.appendChild(el('b', { text: 'Over' }));
      o.appendChild(el('i', { text: '+' + Math.round(over) + ' min' }));
      track.appendChild(o);
    }
    if (!track.children.length) track.appendChild(el('div', { class: 'ribbon-seg free' }));

    document.getElementById('ribbonScale').innerHTML =
      '<span>0</span><span>' + Math.round(scale / 2) + ' min</span><span>' + Math.round(scale) + ' min</span>';

    var note = document.getElementById('ribbonNote');
    note.className = 'ribbon-note';
    var pctHost = document.getElementById('ribbonPct');
    if (pctHost) {
      pctHost.innerHTML = '';
      if (booked) {
        var b = sessionBRT();
        [[Math.round(total / booked * 100) + '%', 'Planned of allocated', total + ' of ' + booked + ' min'],
         [Math.round(b / booked * 100) + '%', 'Ball rolling', b + ' of ' + booked + ' min allocated']]
          .forEach(function (x) {
            pctHost.appendChild(el('div', { class: 'stat' }, [
              el('b', { text: x[0] }), el('span', { text: x[1] }),
              el('span', { class: 'hint', style: 'font-size:11px;letter-spacing:0;text-transform:none', text: x[2] })
            ]));
          });
      }
    }
    if (!booked) { note.textContent = 'Set a session duration to check the fit.'; return; }
    var diff = Math.round(total - booked);
    if (diff > 0) { note.classList.add('bad'); note.textContent = total + ' min planned against ' + booked + ' booked. Cut ' + diff + ' min, or the last activity gets squeezed.'; }
    else if (diff < 0) { note.textContent = total + ' min planned against ' + booked + ' booked. ' + (-diff) + ' min left for transitions, water and the talk.'; }
    else { note.classList.add('good'); note.textContent = 'Planned time matches the booked session exactly.'; }
  }

  /* ---------------- periodization context ---------------- */
  function ctx() {
    var d = S.dayMerged(session.squad, session.date);
    var line = document.getElementById('ctxLine');
    var chips = document.getElementById('ctxChips');
    chips.innerHTML = '';
    if (!d) {
      line.textContent = session.date
        ? 'That date sits outside ' + S.planLabel(session.squad) + ', so nothing is pulled from the periodization plan.'
        : 'Pick a date and plan to pull the periodization row.';
      return;
    }
    line.textContent = d.block + ' · ' + S.dow(session.date) + ' · ' + d.event;
    var add = function (t, c) { chips.appendChild(el('span', { class: 'chip ' + (c || ''), text: t })); };
    add(d.block);
    add('Week ' + d.week);
    if (d.gd) add(d.gd, d.gd === 'Game' ? 'game' : '');
    if (d.rpe) add(d.rpe);
    if (d.duration) add(d.duration);
    if (d.opp) add('v ' + d.opp, 'game');
    if (/^OFF/.test(d.event)) add('No session scheduled on this date', 'flag');

    var ng = S.nextGame(session.squad, session.date);
    if (ng && ng.date !== session.date) add('Next game ' + S.fmt(ng.date) + ' v ' + (ng.opp || 'TBD'));

    var others = S.sessionsOn(session.date, session.squad).filter(function (s) { return s.id !== session.id; });
    if (others.length) add(others.length + ' other saved session on this date', 'flag');

    if (!session.cycleObj && d.block) {
      try {
        var cyc = JSON.parse(localStorage.getItem('ncfc.cycles.v1') || '{}');
        var c = cyc[session.squad + '|' + d.block];
        if (c && c.objective) {
          session.cycleObj = c.objective;
          var n2 = document.getElementById('f_cycleObj');
          if (n2) n2.value = c.objective;
        }
      } catch (e) {}
    }
    if (d.gameSize) {
      session.acts.forEach(function (a) { if (!a.numbers) a.numbers = d.gameSize; });
    }
    if (!session.physLoad && d.rpe) { session.physLoad = d.rpe; document.getElementById('f_physLoad').value = d.rpe; }
    if (d.mins && (!session.duration || session.duration === '75' || session.duration === '90')) {
      session.duration = String(d.mins);
      document.getElementById('f_duration').value = d.mins;
    }
  }

  /* ---------------- principles: moment -> phase -> principle ---------------- */
  function fillSelect(id, options, value, blank) {
    var sel = document.getElementById(id);
    sel.innerHTML = '';
    if (blank !== false) sel.appendChild(el('option', { value: '', text: blank || '- choose -' }));
    options.forEach(function (o) {
      var v = typeof o === 'string' ? o : o.v, t = typeof o === 'string' ? o : o.t;
      sel.appendChild(el('option', { value: v, text: t }));
    });
    sel.value = value || '';
    return sel;
  }

  /* The document's wording is what the coach reads; his own name rides underneath
     wherever the two differ. */
  function label(p) { return '[' + p.clubCode + '] ' + (p.clubName || p.name); }

  function principlesFor(moment, phase) {
    return (window.PRINCIPLES || []).filter(function (p) {
      if (moment && p.moment !== moment) return false;
      if (phase && p.phases.indexOf(phase) < 0) return false;
      return true;
    });
  }

  function cascade(level) {
    // level: 'moment' | 'phase' | 'principle' | 'load'
    if (level === 'moment') { session.phase = ''; session.principleCode = ''; }
    if (level === 'phase' && session.phase && !session.moment) {
      Object.keys(PHASES).forEach(function (m) {
        if (PHASES[m].indexOf(session.phase) >= 0) session.moment = m;
      });
    }
    if (level === 'phase') {
      var still = principlesFor(session.moment, session.phase)
        .some(function (p) { return p.code === session.principleCode; });
      if (!still) session.principleCode = '';
    }

    fillSelect('f_moment', MOMENTS, session.moment, '- choose a moment -');
    var known = Object.keys(PHASES).reduce(function (a, m) { return a.concat(PHASES[m]); }, []);
    var extra = (window.Lists ? window.Lists.get('phases') : []).filter(function (x) { return known.indexOf(x) < 0; });
    var phaseList = session.moment
      ? PHASES[session.moment].concat(extra)
      : Object.keys(PHASES).reduce(function (a, m) {
          return a.concat(PHASES[m].map(function (ph) { return { v: ph, t: m.split(' ')[0] + ' · ' + ph }; }));
        }, []).concat(extra.map(function (x) { return { v: x, t: 'Yours · ' + x }; }));
    fillSelect('f_phase', phaseList, session.phase, '- any phase -');

    var list = principlesFor(session.moment, session.phase);
    fillSelect('f_principleCode', list.map(function (p) { return { v: p.code, t: label(p) }; }),
      session.principleCode, list.length ? '- choose a principle -' : '- nothing at this phase -');

    renderSubs(level === 'principle');
    renderStyleNote();
    if (level === 'principle' || level === 'moment') renderKPIs();
  }

  function renderSubs(adoptCue) {
    var p = S.principle(session.principleCode);
    var box = document.getElementById('subsBox');
    box.innerHTML = '';
    if (!p) {
      box.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'Choose a principle to list its sub-principles.' }));
      return;
    }
    if (p.clubName && p.name && p.clubName !== p.name) {
      box.appendChild(el('p', { class: 'hint', style: 'margin:0 0 8px',
        text: 'Your wording for this one: ' + p.name }));
    }
    var subs = window.Lists ? window.Lists.subsFor(p.code) : p.subs;
    if (!subs.length) {
      box.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'None recorded yet. Add one below.' }));
    }
    subs.forEach(function (sp) {
      var cb = el('input', { type: 'checkbox', value: sp.code });
      cb.checked = session.subs.indexOf(sp.code) >= 0;
      cb.addEventListener('change', function () {
        var i = session.subs.indexOf(sp.code);
        if (cb.checked && i < 0) session.subs.push(sp.code);
        if (!cb.checked && i >= 0) session.subs.splice(i, 1);
        suggestActions();
        mark();
      });
      var kids = [cb, el('code', { text: sp.code }), el('span', { text: sp.text })];
      var act = ACTION_HINTS[sp.code];
      if (act) kids.push(el('span', { class: 'chip', style: 'margin-left:auto;flex:0 0 auto', text: act }));
      kids.push(el('button', {
        class: 'rmx no-print', style: 'margin-left:auto;flex:0 0 auto', type: 'button',
        title: sp.mine ? 'Delete this, it is yours' : 'Hide this from ' + p.clubCode,
        text: '\u2715',
        onclick: function (e) {
          e.preventDefault();
          if (!confirm((sp.mine ? 'Delete' : 'Hide') + ' "' + sp.text.slice(0, 50) +
            '"?\n\nIt goes from ' + p.clubCode + ' in every session.')) return;
          window.Lists.removeSub(p.code, sp.code);
          session.subs = session.subs.filter(function (c) { return c !== sp.code; });
          renderSubs(false); mark();
        }
      }));
      box.appendChild(el('label', {}, kids));
    });
    box.appendChild(el('div', { class: 'btnrow no-print', style: 'margin-top:8px' }, [
      el('button', {
        class: 'btn ghost sm', style: 'flex:1;justify-content:center',
        text: 'Borrow from another principle',
        onclick: function () {
          /* a session often works a sub-principle that lives under a different
             code; borrowing keeps it attached here without retyping it */
          var groups = {};
          (window.PRINCIPLES || []).forEach(function (q) {
            if (q.code === p.code) return;
            var subs = window.Lists.subsFor(q.code);
            if (subs.length) groups['[' + q.clubCode + '] ' + (q.clubName || q.name)] =
              subs.map(function (x) { return x.code + '  ' + x.text; });
          });
          window.Lists.multiPick({
            title: 'Borrow sub-principles', groups: groups,
            onPick: function (picked) {
              picked.forEach(function (line) {
                var t = line.replace(/^\S+\s+/, '');
                var rec = window.Lists.addSub(p.code, t);
                if (rec) session.subs.push(rec.code);
              });
              renderSubs(false); mark();
            }
          });
        }
      })
    ]));
    box.appendChild(el('button', {
      class: 'btn ghost sm no-print', style: 'margin-top:6px;width:100%;justify-content:center',
      text: '+ Write a new sub-principle for ' + p.clubCode,
      onclick: function () {
        var t = prompt('New sub-principle for ' + p.clubCode + ' ' + (p.clubName || p.name));
        if (!t) return;
        var rec = window.Lists.addSub(p.code, t);
        if (rec) {
          session.subs.push(rec.code);
          renderSubs(false); mark();
          S.toast('Added to ' + p.clubCode + ' for every session from now on.');
        }
      }
    }));
  }


  /* ---------------- player actions ----------------
     A player action is not a principle. It is the individual execution the
     sub-principle demands, so it lives on its own axis and is tagged, not chosen
     instead of a principle. */
  var ACTION_HINTS = {
    'IP1.4': 'Receiving With Time', 'IP4.1': 'Passing', 'IP5.2': 'Passing',
    'IP6.1': 'Passing', 'IP6.3': 'Passing', 'IP7.1': 'Receiving to Escape Opponent',
    'IP9.3': 'Passing', 'OP16.4': 'Marking & Tracking', 'OP17.1': 'Closing Down',
    'OP17.2': 'Engaging', 'TR10.3a': 'Passing', 'TR10.3c': 'Passing', 'TR10.3d': 'Passing',
    'TR11.2a': 'Closing Down', 'TR11.3a': 'Closing Down'
  };

  function actionOptions() {
    var pa = (window.Lists ? window.Lists.getGroups('playerActions') : null) ||
      (window.CLUB && window.CLUB.playerActions) || {};
    var out = [];
    Object.keys(pa).forEach(function (g) {
      out.push({ group: g, items: pa[g] });
    });
    return out;
  }

  function actionSelect(value, onchange) {
    var sel = el('select');
    sel.appendChild(el('option', { value: '', text: '-' }));
    actionOptions().forEach(function (g) {
      var og = el('optgroup', { label: g.group });
      g.items.forEach(function (a) { og.appendChild(el('option', { value: a, text: a })); });
      sel.appendChild(og);
    });
    sel.value = value || '';
    sel.addEventListener('change', function () { onchange(sel.value); });
    return sel;
  }

  function renderPA() {
    var host = document.getElementById('paBox');
    host.innerHTML = '';
    host.className = '';
    if (!Array.isArray(session.pa)) session.pa = [];
    session.pa = session.pa.filter(Boolean);
    host.appendChild(paPicker(session.pa, function (c) { session.pa = c; mark(); renderPA(); }));
    suggestActions();
  }

  function suggestActions() {
    var hints = [];
    (session.subs || []).forEach(function (c) {
      if (ACTION_HINTS[c] && hints.indexOf(ACTION_HINTS[c]) < 0) hints.push(ACTION_HINTS[c]);
    });
    var host = document.getElementById('paHint');
    var n = (session.pa || []).filter(Boolean).length;
    if (!hints.length) {
      host.textContent = n
        ? n + ' selected. Two or three is usually enough to observe honestly.'
        : 'Pick the individual actions this session demands. Two or three is usually enough to observe honestly.';
      return;
    }
    host.innerHTML = 'The sub-principles you ticked are worded as these actions: ' +
      hints.map(function (h) { return '<strong>' + esc(h) + '</strong>'; }).join(', ') + '.';
  }

  /* ---------------- readiness ----------------
     Polled per player. Only players marked Present or Present-Late count
     toward the average, so an absent squad member cannot drag the gate down. */
  var K_IDP = 'ncfc.idp.v1';
  function roster() {
    var d;
    try { d = JSON.parse(localStorage.getItem(K_IDP) || '{}'); } catch (e) { d = {}; }
    var out = [];
    Object.keys(d.players || {}).forEach(function (k) {
      if (d.players[k].plan === session.squad) out.push(d.players[k]);
    });
    out.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return out;
  }
  function readyItems() { return ((window.CLUB && window.CLUB.readiness) || { items: [] }).items; }

  /* ---------------- success criteria ----------------
     Chosen at plan time against the session's principle. Counted at the
     field on the tally sheet. Compared in the review. */
  function renderKPIs() {
    var host = document.getElementById('kpiBox');
    if (!host || !window.KPI) return;
    host.innerHTML = '';
    session.kpis = session.kpis || [];

    var sel = document.getElementById('kpiPick');
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '', text: '+ Add a KPI to this session' }));
    var mine = window.KPI.forPrinciple(session.principleCode);
    var rest = window.KPI.all().filter(function (x) { return mine.indexOf(x) < 0; });
    function opt(list, label) {
      if (!list.length) return;
      var og = el('optgroup', { label: label });
      list.forEach(function (x) {
        if (session.kpis.some(function (t) { return t.id === x.id; })) return;
        og.appendChild(el('option', { value: x.id, text: x.category }));
      });
      if (og.children.length) sel.appendChild(og);
    }
    opt(mine, 'For this principle');
    opt(rest, 'Everything else');
    sel.onchange = function () {
      if (!sel.value) return;
      session.kpis.push(window.KPI.blankTally(sel.value));
      sel.value = ''; renderKPIs(); mark();
    };

    if (!window.KPI.all().length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'No KPIs defined yet. ' }),
        el('a', { href: 'kpi.html', text: 'Define some' }),
        el('span', { text: ', or start from your principles in one click.' })
      ]));
      return;
    }
    if (!session.kpis.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'Nothing chosen. One or two is plenty: a KPI you cannot honestly count while coaching is not a KPI.' }));
      return;
    }

    session.kpis.forEach(function (t, i) {
      var def = window.KPI.get(t.id);
      if (!def) return;
      var unit = (window.KPI.UNITS.filter(function (u) { return u.v === def.unit; })[0] || {}).label || def.unit;
      var card = el('div', { class: 'act', style: 'border-left-color:var(--turf)' });
      card.appendChild(el('div', { class: 'act-hd' }, [
        el('span', { class: 'lab', text: def.category }),
        el('span', { class: 'chip', text: unit }),
        el('span', { class: 'sp' }),
        el('button', { class: 'btn warn sm no-print', text: 'Remove',
          onclick: function () { session.kpis.splice(i, 1); renderKPIs(); mark(); } })
      ]));
      var bd = el('div', { class: 'act-bd' });
      if (def.description) bd.appendChild(el('p', { class: 'hint', style: 'margin:0 0 10px', text: def.description }));

      var g = el('div', { class: 'grid g4' });
      if (def.unit === 'rate') {
        var tS = el('input', { type: 'number', class: 'num', step: '1', min: '0', placeholder: 'e.g. 8' });
        tS.value = t.tSucc || '';
        var tO = el('input', { type: 'number', class: 'num', step: '1', min: '1', placeholder: 'e.g. 20' });
        tO.value = t.tOpps || '';
        function sync() { t.tSucc = tS.value; t.tOpps = tO.value; renderKPIs(); mark(); }
        tS.addEventListener('input', sync);
        tO.addEventListener('input', sync);
        g.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Successes wanted' }), tS]));
        g.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Out of opportunities' }), tO]));
      } else {
        var tgt = el('input', { type: 'number', class: 'num', step: '1', min: '0', placeholder: 'e.g. 8' });
        tgt.value = t.target || '';
        tgt.addEventListener('input', function () { t.target = tgt.value; renderKPIs(); mark(); });
        g.appendChild(el('label', { class: 'f span2' }, [el('span', { text: 'Success looks like' }), tgt]));
      }

      var res = el('div', { class: 'f' }, [
        el('span', { class: 'eyebrow', style: 'margin:0', text: 'Counted so far' }),
        el('div', { style: 'font-family:var(--mono);font-size:18px;padding-top:4px',
          text: window.KPI.fmtActual(t, def.unit) })
      ]);
      g.appendChild(res);

      var m = window.KPI.met(t, def.unit);
      g.appendChild(el('div', { class: 'f' }, [
        el('span', { class: 'eyebrow', style: 'margin:0', text: 'Target' }),
        el('div', { style: 'font-family:var(--mono);font-size:15px;padding-top:6px',
          text: window.KPI.targetLabel(t, def.unit) || 'not set' })
      ]));
      g.appendChild(el('div', { class: 'f' }, [
        el('span', { class: 'eyebrow', style: 'margin:0', text: 'Against target' }),
        el('div', { style: 'padding-top:6px' }, [el('span', {
          class: 'chip ' + (m === null ? 'off' : (m ? 'ao' : 'dt')),
          text: m === null ? 'not counted yet' : (m ? 'target met' : 'short of target') })])
      ]));
      bd.appendChild(g);

      var note = el('input', { type: 'text', placeholder: 'What you saw' });
      note.value = t.note || '';
      note.addEventListener('input', function () { t.note = note.value; mark(); });
      var ev = el('input', { type: 'text', placeholder: 'Clip link or timestamp' });
      ev.value = t.evidence || '';
      ev.addEventListener('input', function () { t.evidence = ev.value; mark(); });
      bd.appendChild(el('div', { class: 'grid g2', style: 'margin-top:10px' }, [
        el('label', { class: 'f' }, [el('span', { text: 'Note' }), note]),
        el('label', { class: 'f' }, [el('span', { text: 'Evidence' }), ev])
      ]));

      card.appendChild(bd);
      host.appendChild(card);
    });
  }

  /* The style statement for the chosen moment, shown while you plan, so the
     game model is present at the point of decision rather than filed away. */
  function renderStyleNote() {
    var host = document.getElementById('styleNote');
    if (!host) return;
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.gamemodel.v1') || '{}') || {}; } catch (e) { d = {}; }
    host.innerHTML = '';
    var bits = [];
    if (d.identity) bits.push(['Identity', d.identity]);
    if (session.moment && d.style && d.style[session.moment]) bits.push([session.moment, d.style[session.moment]]);
    if (!bits.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0' }, [
        el('span', { text: 'No style of play written yet. ' }),
        el('a', { href: 'model.html', text: 'Write it on the game model page' }),
        el('span', { text: ' and it will sit here while you plan.' })
      ]));
      return;
    }
    bits.forEach(function (b) {
      host.appendChild(el('p', { style: 'margin:0 0 6px' }, [
        el('span', { class: 'chip ' + (b[0] === 'Identity' ? '' : S.momentKey(b[0])), text: b[0] }),
        el('span', { class: 'hint', style: 'margin-left:8px', text: b[1] })
      ]));
    });
  }

  /* ---------- the instance library ----------
     Examples to start from and a place to keep your own. Loading one fills the
     name and the components; it does not touch anything else on the plan. */
  var IK = 'ncfc.instances.v1';
  function instMine() {
    try { return JSON.parse(localStorage.getItem(IK) || '[]'); } catch (e) { return []; }
  }
  function instSaveMine(list) {
    try { localStorage.setItem(IK, JSON.stringify(list)); return true; }
    catch (e) { S.toast('Could not save.'); return false; }
  }
  function instAll() {
    return instMine().concat(window.INSTANCES || []);
  }

  function openInstanceLibrary() {
    var list = instAll();
    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var card = el('div', { class: 'card', style: 'max-width:680px;width:100%;max-height:88vh;display:flex;flex-direction:column' });
    card.appendChild(el('div', { class: 'card-hd' }, [
      el('h2', { text: 'Instances' }),
      el('p', { class: 'hint', style: 'margin-left:auto', text: list.length + ' to start from' })
    ]));
    var bd = el('div', { class: 'card-bd', style: 'overflow:auto;flex:1' });
    var search = el('input', { type: 'text', placeholder: 'Filter by name, principle or wording' });
    bd.appendChild(el('label', { class: 'f', style: 'margin-bottom:10px' }, [search]));
    var host = el('div');
    bd.appendChild(host);

    function draw(q) {
      host.innerHTML = '';
      var shown = list.filter(function (x) {
        if (!q) return true;
        var hay = [x.name, x.principle, x.moment, x.igs, x.strategy,
          x.components.map(function (c) { return c.text; }).join(' ')].join(' ').toLowerCase();
        return hay.indexOf(q.toLowerCase()) >= 0;
      });
      if (!shown.length) { host.appendChild(el('p', { class: 'hint', text: 'Nothing matches.' })); return; }
      shown.forEach(function (x) {
        var p2 = S.principle(x.principle);
        var row = el('div', { class: 'act', style: 'border-left-color:var(--turf)' });
        row.appendChild(el('div', { class: 'act-hd' }, [
          el('span', { class: 'lab', text: x.name }),
          p2 ? el('span', { class: 'chip ' + S.momentKey(p2.moment), text: p2.clubCode }) : null,
          el('span', { class: 'chip', text: x.components.length + ' components' }),
          x.source ? el('span', { class: 'chip off', text: x.source }) : null,
          el('span', { class: 'sp' }),
          el('button', { class: 'btn turf sm', text: 'Use it', onclick: function () {
            session.instanceName = x.name;
            session.components = JSON.parse(JSON.stringify(x.components));
            if (!session.igs && x.igs) session.igs = x.igs;
            if (!session.strategy && x.strategy) session.strategy = x.strategy;
            if (!session.principleCode && x.principle) session.principleCode = x.principle;
            back.remove();
            toForm();
            S.toast('Loaded. Edit it here without changing the example.');
          } }),
          x.mine ? el('button', { class: 'btn warn sm', text: 'Delete', onclick: function () {
            if (!confirm('Delete "' + x.name + '" from your instances?')) return;
            instSaveMine(instMine().filter(function (y) { return y.id !== x.id; }));
            list = instAll(); draw(search.value);
          } }) : null
        ]));
        var bd2 = el('div', { class: 'act-bd' });
        if (x.igs) bd2.appendChild(el('p', { class: 'hint', style: 'margin:0 0 6px', text: x.igs }));
        var ol = el('ol', { style: 'margin:0;padding-left:20px;font-size:13px;line-height:1.55' });
        x.components.forEach(function (c) {
          ol.appendChild(el('li', {}, [
            el('span', { text: c.text }),
            c.filter ? el('span', { class: 'hint', style: 'display:block;font-size:11.5px',
              text: 'filter: ' + c.filter }) : null
          ]));
        });
        bd2.appendChild(ol);
        row.appendChild(bd2);
        host.appendChild(row);
      });
    }
    var t;
    search.addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(function () { draw(search.value); }, 150);
    });
    draw('');
    card.appendChild(bd);
    card.appendChild(el('div', { class: 'card-bd', style: 'border-top:1px solid var(--chalk-3)' }, [
      el('p', { class: 'hint', style: 'margin:0 0 8px',
        text: 'Using one copies it onto this session. The example is unchanged, and what you edit here stays here ' +
          'until you save it back as your own.' }),
      el('button', { class: 'btn ghost', text: 'Close', onclick: function () { back.remove(); } })
    ]));
    back.appendChild(card);
    document.body.appendChild(card.parentNode === back ? back : back);
    search.focus();
  }

  function saveInstance() {
    var comps = (session.components || []).filter(function (c) { return (c.text || '').trim(); });
    if (!session.instanceName || !comps.length) {
      S.toast('Name the instance and write at least one component first.');
      return;
    }
    var mine = instMine();
    var rec = {
      id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      mine: true, name: session.instanceName, principle: session.principleCode || '',
      moment: session.moment || '', igs: session.igs || '', strategy: session.strategy || '',
      source: 'Yours', components: JSON.parse(JSON.stringify(comps))
    };
    mine.unshift(rec);
    if (instSaveMine(mine)) S.toast('Kept. It is in the list for every session from now on.');
  }

  /* ---------- the instance ----------
     Game model, principle, strategy, identified game situation, instance. The
     instance is the last link and the only one you can actually see, so it is
     written as named components rather than a paragraph. A filter is context
     applied to a component: how much of it has to be there before the moment
     counts for these players. */
  function renderComponents() {
    var host = document.getElementById('components');
    if (!host) return;
    host.innerHTML = '';
    session.components = session.components || [];
    if (!session.components.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'None yet. Write what has to be true at the same time for the moment to be on. ' +
          'The example US Soccer uses: the ball carrier can play forward, space is behind the backline, ' +
          'a teammate is ahead of the ball to run onto it.' }));
      return;
    }
    session.components.forEach(function (c, i) {
      var row = el('div', { class: 'act', style: 'border-left-color:var(--turf)' });
      var t = el('input', { type: 'text', value: c.text || '',
        placeholder: 'Something you would see', style: 'flex:1 1 260px' });
      t.addEventListener('input', function () { c.text = t.value; renderInstanceCheck(); mark(); });
      row.appendChild(el('div', { class: 'act-hd' }, [
        el('span', { class: 'chip', text: String(i + 1) }), t,
        el('span', { class: 'sp' }),
        el('button', { class: 'btn ghost sm no-print', text: '\u2191',
          onclick: function () { if (i > 0) { session.components.splice(i - 1, 0, session.components.splice(i, 1)[0]); renderComponents(); mark(); } } }),
        el('button', { class: 'btn ghost sm no-print', text: '\u2193',
          onclick: function () { if (i < session.components.length - 1) { session.components.splice(i + 1, 0, session.components.splice(i, 1)[0]); renderComponents(); mark(); } } }),
        el('button', { class: 'btn warn sm no-print', text: 'Remove',
          onclick: function () { session.components.splice(i, 1); renderComponents(); mark(); } })
      ]));
      var bd = el('div', { class: 'act-bd' });
      var f = el('input', { type: 'text', value: c.filter || '',
        placeholder: 'how much of it has to be there, for these players' });
      f.addEventListener('input', function () { c.filter = f.value; renderInstanceCheck(); mark(); });
      var m = el('input', { type: 'text', value: c.missing || '',
        placeholder: 'how you influence it to appear' });
      m.addEventListener('input', function () { c.missing = m.value; mark(); });
      bd.appendChild(el('div', { class: 'grid g2' }, [
        el('label', { class: 'f' }, [el('span', { text: 'Filter' }), f]),
        el('label', { class: 'f' }, [el('span', { text: 'If it is missing' }), m])
      ]));
      row.appendChild(bd);
      host.appendChild(row);
    });
  }

  /* the four questions the course asks of a finished instance */
  var CHECKS = [
    'Is every component something you would see?',
    'If only one of them happened, how do you respond?',
    'What is still missing?',
    'Would another coach agree the moment happened?'
  ];
  function renderInstanceCheck() {
    var host = document.getElementById('instanceCheck');
    if (!host) return;
    host.innerHTML = '';
    var n = (session.components || []).filter(function (c) { return (c.text || '').trim(); }).length;
    var noFilter = (session.components || []).filter(function (c) {
      return (c.text || '').trim() && !(c.filter || '').trim();
    }).length;
    host.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px', text: 'Check it' }));
    var ul = el('ul', { class: 'hint', style: 'margin:0;padding-left:18px;line-height:1.8' });
    CHECKS.forEach(function (q) { ul.appendChild(el('li', { text: q })); });
    host.appendChild(ul);
    var note = [];
    if (!session.instanceName) note.push('the instance has no name yet');
    if (!n) note.push('no components written');
    else if (n < 2) note.push('one component on its own rarely makes a moment');
    if (noFilter) note.push(noFilter + ' component' + (noFilter === 1 ? '' : 's') + ' without a filter, which is fine if the component is enough on its own');
    host.appendChild(el('p', { class: 'hint', style: 'margin:8px 0 0' }, [
      el('span', { class: 'chip ' + (n >= 2 && session.instanceName ? 'ao' : 'off'),
        text: n + ' component' + (n === 1 ? '' : 's') }),
      el('span', { style: 'margin-left:8px', text: note.join('; ') })
    ]));
  }

  function renderLevel() {
    var C = window.CLUB || {};
    fillSelect('f_level', (C.learningLevels || []).map(function (x) { return { v: x.v, t: x.t }; }),
      session.level, '- how new is this to them -');
    var hint = document.getElementById('levelHint');
    if (!hint) return;
    var lv = (C.learningLevels || []).filter(function (x) { return x.v === session.level; })[0];
    hint.textContent = lv ? lv.hint :
      'A concept that is new to a U13 is not new to a U19. This changes how you coach it, not what you coach.';
  }

  /* Key players: a number is enough, because a session on wide play is about
     7 and 11 whether or not you have named them. A name links the record. */
  function rosterPlayers() {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    return Object.keys(d.players || {}).map(function (k) { return d.players[k]; })
      .filter(function (p) { return p.plan === session.squad; })
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }

  function renderKeyPlayers() {
    var host = document.getElementById('keyBox');
    if (!host) return;
    host.innerHTML = '';
    session.keyPlayers = session.keyPlayers || [];
    if (!session.keyPlayers.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'None named. Add the numbers the session actually turns on.' }));
      return;
    }
    var people = rosterPlayers();
    session.keyPlayers.forEach(function (k, i) {
      var row = el('div', { class: 'grid g4', style: 'margin-bottom:8px;align-items:end' });

      var num = el('input', { type: 'text', class: 'num', maxlength: 3, placeholder: '7' });
      num.value = k.num || '';
      num.addEventListener('input', function () { k.num = num.value; mark(); });

      var pos = el('select');
      pos.appendChild(el('option', { value: '', text: '- position -' }));
      ((window.CLUB && window.CLUB.positions) || []).forEach(function (x) {
        pos.appendChild(el('option', { value: x.code, text: x.code + ' \u00b7 ' + x.name }));
      });
      pos.value = k.pos || '';
      pos.addEventListener('change', function () { k.pos = pos.value; renderKeyPlayers(); mark(); });

      var name = el('select');
      name.appendChild(el('option', { value: '', text: '- no name needed -' }));
      people.forEach(function (p) {
        name.appendChild(el('option', { value: p.id, text: (p.number ? p.number + ' ' : '') + p.name }));
      });
      name.value = k.playerId || '';
      name.addEventListener('change', function () {
        k.playerId = name.value;
        var p = people.filter(function (x) { return x.id === name.value; })[0];
        k.name = p ? p.name : '';
        if (p && !k.num && p.number) k.num = p.number;
        if (p && !k.pos && p.position) k.pos = p.position;
        renderKeyPlayers(); mark();
      });

      var why = el('input', { type: 'text', placeholder: 'why they are key today' });
      why.value = k.why || '';
      why.addEventListener('input', function () { k.why = why.value; mark(); });

      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'No.' }), num]));
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Position' }), pos]));
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Player' }), name]));
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Why' }), why]));
      host.appendChild(row);

      var links = el('div', { class: 'btnrow no-print', style: 'margin:-2px 0 12px' });
      if (k.playerId) {
        links.appendChild(el('a', { class: 'btn ghost sm', href: 'idp.html', text: 'IDP sheet' }));
        links.appendChild(el('a', { class: 'btn ghost sm', href: 'kpi.html', text: 'KPI record' }));
      }
      if (k.pos) links.appendChild(el('a', { class: 'btn ghost sm', href: 'model.html#profiles?pos=' + k.pos, text: k.pos + ' profile' }));
      links.appendChild(el('button', { class: 'btn warn sm', text: 'Remove',
        onclick: function () { session.keyPlayers.splice(i, 1); renderKeyPlayers(); mark(); } }));
      host.appendChild(links);
    });
  }

  function renderReadiness() {
    var host = document.getElementById('readyBox');
    if (!host) return;
    host.innerHTML = '';
    host.className = '';
    if (!session.ready) session.ready = {};
    var people = roster();

    var modeRow = el('div', { class: 'btnrow no-print', style: 'margin-bottom:12px' }, [
      el('button', { class: 'btn ghost sm' + (session.readyMode !== 'squad' ? '' : ' '), text: 'By player',
        onclick: function () { session.readyMode = 'player'; renderReadiness(); mark(); } }),
      el('button', { class: 'btn ghost sm', text: 'Squad average only',
        onclick: function () { session.readyMode = 'squad'; renderReadiness(); mark(); } })
    ]);
    host.appendChild(modeRow);

    if (session.readyMode === 'squad' || !people.length) {
      if (!people.length) {
        host.appendChild(el('p', { class: 'hint', style: 'margin:0 0 10px' }, [
          el('span', { text: 'No roster on this plan yet, so this is a single squad-level reading. ' }),
          el('a', { href: 'idp.html', text: 'Add players' }),
          el('span', { text: ' to poll individually.' })
        ]));
      }
      var grid = el('div', { class: 'grid g4' });
      readyItems().forEach(function (it) {
        var wrap = el('div', { class: 'readycell' });
        wrap.appendChild(el('span', { class: 'eyebrow', style: 'margin:0', text: it.label }));
        var r = el('input', { type: 'range', min: '1', max: '5', step: '1' });
        r.value = (session.ready.squad && session.ready.squad[it.k]) || 4;
        var v = el('span', { class: 'val', text: r.value + ' / 5' });
        r.addEventListener('input', function () {
          session.ready.squad = session.ready.squad || {};
          session.ready.squad[it.k] = +r.value;
          v.textContent = r.value + ' / 5';
          gate(); mark();
        });
        wrap.appendChild(r); wrap.appendChild(v);
        wrap.appendChild(el('span', { class: 'hint', style: 'font-size:11px', text: it.low + ' to ' + it.high }));
        grid.appendChild(wrap);
      });
      host.appendChild(grid);
      gate();
      return;
    }

    var scroll = el('div', { class: 'tbl-scroll' });
    var tbl = el('table', { class: 'grid-t fixed' });
    var W = [150, 132].concat(readyItems().map(function () { return 92; })).concat([70]);
    tbl.style.minWidth = W.reduce(function (a, b) { return a + b; }, 0) + 'px';
    var cg = el('colgroup');
    W.forEach(function (x) { cg.appendChild(el('col', { style: 'width:' + x + 'px' })); });
    tbl.appendChild(cg);
    tbl.appendChild(el('thead', {}, [el('tr', {},
      [el('th', { text: 'Player' }), el('th', { text: 'Attendance' })]
        .concat(readyItems().map(function (it) { return el('th', { text: it.label }); }))
        .concat([el('th', { text: 'Mean' })]))]));

    var body = el('tbody');
    people.forEach(function (pl) {
      var rec = session.ready[pl.id] || {};
      var tr = el('tr');
      tr.appendChild(el('td', { class: 'prose', text: (pl.number ? pl.number + ' ' : '') + pl.name }));

      var att = el('select');
      ['Present'].concat((window.Lists ? window.Lists.get('attendance') : []).filter(function (x) { return x !== 'Present'; }))
        .forEach(function (x) { att.appendChild(el('option', { value: x, text: x })); });
      att.value = rec.att || 'Present';
      att.addEventListener('change', function () {
        session.ready[pl.id] = Object.assign({}, session.ready[pl.id], { att: att.value });
        renderReadiness(); mark();
      });
      tr.appendChild(el('td', {}, [att]));

      var counted = /^Present/.test(rec.att || 'Present');
      readyItems().forEach(function (it) {
        var sel = el('select', { disabled: counted ? null : 'disabled' });
        sel.appendChild(el('option', { value: '', text: '-' }));
        [1, 2, 3, 4, 5].forEach(function (n) { sel.appendChild(el('option', { value: String(n), text: String(n) })); });
        sel.value = rec[it.k] ? String(rec[it.k]) : '';
        sel.addEventListener('change', function () {
          var r2 = Object.assign({}, session.ready[pl.id]);
          if (sel.value) r2[it.k] = +sel.value; else delete r2[it.k];
          session.ready[pl.id] = r2;
          renderReadiness(); mark();
        });
        tr.appendChild(el('td', {}, [sel]));
      });

      var m = playerMean(rec);
      tr.appendChild(el('td', {}, [counted && m
        ? el('span', { class: 'chip ' + (m >= 4.3 ? 'ao' : (m >= 3.5 ? 'at' : 'dt')), text: m.toFixed(1) })
        : el('span', { class: 'chip off', text: counted ? '-' : 'out' })]));
      body.appendChild(tr);
    });
    tbl.appendChild(body);
    scroll.appendChild(tbl);
    host.appendChild(scroll);
    gate();
  }

  function playerMean(rec) {
    var items = readyItems(), t = 0, n = 0;
    items.forEach(function (it) { if (rec && rec[it.k]) { t += rec[it.k]; n++; } });
    return n ? t / n : 0;
  }

  /* Mean of player means, so a player who answered three of five questions
     still counts once rather than counting less. */
  function readinessDetail() {
    var people = roster();
    if (session.readyMode === 'squad' || !people.length) {
      var rec = (session.ready && session.ready.squad) || {};
      var m = playerMean(rec);
      return { score: m || 0, counted: m ? 1 : 0, present: 1, polled: !!m, mode: 'squad' };
    }
    var present = 0, counted = 0, total = 0;
    people.forEach(function (pl) {
      var rec = (session.ready && session.ready[pl.id]) || {};
      if (!/^Present/.test(rec.att || 'Present')) return;
      present++;
      var m = playerMean(rec);
      if (m) { counted++; total += m; }
    });
    return { score: counted ? total / counted : 0, counted: counted, present: present,
      polled: counted > 0, mode: 'player', squad: people.length };
  }
  function readinessScore() { return readinessDetail().score; }

  function gate() {
    var out = document.getElementById('readyOut');
    if (!out) return;
    var C = (window.CLUB && window.CLUB.readiness) || { gates: [] };
    var det = readinessDetail();
    out.innerHTML = '';
    if (!det.polled) {
      out.appendChild(el('div', { class: 'gate' }, [
        el('span', { class: 'chip off', text: 'Not polled' }),
        el('span', { class: 'hint', style: 'flex:1', text: 'Score a player once the squad is in. Nothing here changes the plan on its own.' })
      ]));
      return;
    }
    var sc = det.score;
    var g = (C.gates || []).filter(function (x) { return sc >= x.min; })[0] || { label: '-', action: '', cls: '' };
    out.appendChild(el('div', { class: 'gate' }, [
      el('span', { class: 'chip ' + g.cls, text: g.label }),
      el('b', { text: sc.toFixed(1) }),
      el('span', { class: 'hint', style: 'flex:1', text: g.action })
    ]));
    var how = det.mode === 'squad'
      ? 'One squad-level reading, the mean of the questions you answered.'
      : 'Mean of ' + det.counted + ' player mean' + (det.counted === 1 ? '' : 's') +
        ', from ' + det.present + ' marked present out of ' + det.squad +
        '. Absent and excused players are excluded, and a player who answered some questions still counts once.';
    var brtNow = sessionBRT();
    out.appendChild(el('p', { class: 'hint', style: 'margin:8px 0 0',
      text: how + ' Currently planned: ' + sessionTotal() + ' min, ' + brtNow + ' min ball rolling.' +
        (sc < 3.5 && brtNow ? ' A quarter off would be about ' + Math.round(brtNow * 0.75) + ' min.' : '') }));
  }

  function fillClubSelects() {
    var C = window.CLUB || {};
    fillSelect('f_cogLoad', C.cognitiveLoad || [], session.cogLoad, '- choose -');
    fillSelect('f_physLoad', L('trainingLoad'), session.physLoad, '- choose -');
    fillSelect('f_location', L('fields'), session.location, '- choose -');
    fillSelect('f_method', L('methods'), session.method, '- choose -');
    picker('pick_intent', C.intentions, 'f_focus', 'Add team intentions');
    picker('pick_obj', C.objectives, 'f_objectives', 'Add training objectives');
    picker('pick_cycleObj', L('cycleObjectives'), 'f_cycleObj', 'Add cycle objectives', false, 'cycleObjectives');
    picker('pick_igs', L('scenarios'), 'f_igs', 'Add in-game scenarios', false, 'scenarios');
    picker('pick_strategy', L('strategies'), 'f_strategy', 'Add strategies', false, 'strategies');
    picker('pick_learningPlan', L('learningPlans'), 'f_learningPlan', 'Add learning plan lines', false, 'learningPlans');
    picker('pick_instances', L('instances'), 'f_instances', 'Add instances to look for', false, 'instances');
  }

  /* Pickers append a line into the field rather than replacing it, so the club's
     wording and yours can sit side by side. Every one reads through Lists. */
  /* Every list field opens the same checklist: tick as many as apply, they arrive
     as lines. Single-value fields (the cue) replace instead of appending. */
  function picker(id, source, targetId, blank, replace, listKey) {
    var node = document.getElementById(id);
    if (!node) return;
    var btn = el('button', { class: 'btn ghost sm no-print', type: 'button', text: blank });
    btn.style.marginTop = '5px';
    node.parentNode.replaceChild(btn, node);
    btn.id = id;
    btn.addEventListener('click', function () {
      window.Lists.multiPick({
        title: blank.replace(/^Add an?/i, 'Choose').replace(/^Add /i, 'Choose '),
        items: Array.isArray(source) ? source : null,
        groups: Array.isArray(source) ? null : source,
        listKey: listKey || null,
        onPick: function (picked) {
          var t = document.getElementById(targetId);
          if (replace) t.value = picked[0];
          else t.value = (t.value ? t.value.replace(/\s*$/, '') + '\n' : '') + picked.join('\n');
          session[targetId.replace('f_', '')] = t.value;
          mark();
        }
      });
    });
  }
  function L(k) { return (window.Lists && window.Lists.get(k)) || []; }


  /* ---------------- activities ---------------- */
  function renderActs() {
    var host = document.getElementById('acts');
    host.innerHTML = '';
    if (!session.acts.length) {
      host.appendChild(el('div', { class: 'empty', text: 'No activities yet. Add Activity 1 to start.' }));
      drawRibbon(); return;
    }
    session.acts.forEach(function (a, i) { host.appendChild(actCard(a, i)); });
    renderAddSlots();
    refreshBoardSelects();
    renderOrphanDiagrams();
    drawRibbon();
  }

  function ta(a, key, label, rows, ph) {
    var t = el('textarea', { rows: rows || 2, placeholder: ph || '' });
    t.value = a[key] || '';
    t.addEventListener('input', function () { a[key] = t.value; mark(); });
    return el('label', { class: 'f' }, [el('span', { text: label }), t]);
  }
  function ni(a, key, label) {
    var inp = el('input', { type: 'number', class: 'num', step: '0.5', min: '0' });
    inp.value = a[key] || '';
    inp.addEventListener('input', function () { a[key] = inp.value; recalc(a); mark(); });
    return el('label', { class: 'f' }, [el('span', { text: label }), inp]);
  }

  function multi(list, chosen, onchange, listKey) {
    var box = el('div', { class: 'subs', style: 'max-height:130px' });
    (list || []).forEach(function (x) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = (chosen || []).indexOf(x) >= 0;
      cb.addEventListener('change', function () {
        var c = (chosen || []).slice();
        var i = c.indexOf(x);
        if (cb.checked && i < 0) c.push(x);
        if (!cb.checked && i >= 0) c.splice(i, 1);
        onchange(c);
      });
      var kids2 = [cb, el('span', { text: x })];
      if (listKey && window.Lists) kids2.push(window.Lists.removeBtn(listKey, x, function () {
        onchange((chosen || []).filter(function (y) { return y !== x; }));
      }));
      box.appendChild(el('label', {}, kids2));
    });
    return box;
  }

  /* The club list is twelve groups in one scroll. Split it by side of the ball,
     because a session is usually built on one of them. */
  var PA_SIDES = [
    { key: 'off', label: 'Offensive', match: /^Attacking/, cls: 'ao' },
    { key: 'def', label: 'Defensive', match: /^Defending/, cls: 'do' },
    { key: 'tra', label: 'Transition', match: /^Transition/, cls: 'at' }
  ];
  function sideOf(group) {
    for (var i = 0; i < PA_SIDES.length; i++) if (PA_SIDES[i].match.test(group)) return PA_SIDES[i];
    return PA_SIDES[0];
  }
  function paBySide() {
    var groups = (window.Lists ? window.Lists.getGroups('playerActions') : null) ||
      (window.CLUB && window.CLUB.playerActions) || {};
    var out = {};
    PA_SIDES.forEach(function (s2) { out[s2.key] = []; });
    Object.keys(groups).forEach(function (g) {
      out[sideOf(g).key].push({ group: g.replace(/^(Attacking|Defending|Transition)\s*>?\s*/, '') || g, raw: g, items: groups[g] });
    });
    return out;
  }

  function paPicker(chosen, onchange) {
    var wrap = el('div', { class: 'pasplit' });
    var by = paBySide();
    PA_SIDES.forEach(function (side) {
      var col = el('div', { class: 'pacol' });
      var n = 0;
      (by[side.key] || []).forEach(function (grp) {
        grp.items.forEach(function (x) { if ((chosen || []).indexOf(x) >= 0) n++; });
      });
      col.appendChild(el('div', { class: 'pahd' }, [
        el('span', { class: 'chip ' + side.cls, text: side.label }),
        el('span', { class: 'hint', text: n ? n + ' selected' : '' })
      ]));
      var box = el('div', { class: 'subs', style: 'max-height:230px;border-top:0;border-radius:0 0 3px 3px' });
      (by[side.key] || []).forEach(function (grp) {
        box.appendChild(el('p', { class: 'eyebrow', style: 'margin:8px 0 3px', text: grp.group }));
        grp.items.forEach(function (x) {
          var cb = el('input', { type: 'checkbox' });
          cb.checked = (chosen || []).indexOf(x) >= 0;
          cb.addEventListener('change', function () {
            var c = (chosen || []).slice();
            var i = c.indexOf(x);
            if (cb.checked && i < 0) c.push(x);
            if (!cb.checked && i >= 0) c.splice(i, 1);
            onchange(c);
          });
          box.appendChild(el('label', {}, [cb, el('span', { text: x }),
            window.Lists.removeGroupBtn('playerActions', x, function () {
              onchange((chosen || []).filter(function (y) { return y !== x; }));
            })]));
        });
      });
      col.appendChild(box);
      col.appendChild(el('button', {
        class: 'btn ghost sm no-print', style: 'margin-top:6px;width:100%;justify-content:center',
        text: '+ Add a ' + side.label.toLowerCase() + ' action',
        onclick: function () {
          var names = (by[side.key] || []).map(function (g2) { return g2.raw; });
          if (!names.length) return;
          var g = names.length === 1 ? names[0]
            : prompt('Which group?\n\n' + names.join('\n'), names[0]);
          if (!g) return;
          var v = prompt('New player action');
          if (!v) return;
          window.Lists.addToGroup('playerActions', g, v);
          var c = (chosen || []).slice();
          c.push(v.trim());
          onchange(c);
          S.toast('Added. It is in the list for every session from now on.');
        }
      }));
      wrap.appendChild(col);
    });
    return wrap;
  }

  /* group the chosen actions by side, for print and for the review */
  function paGrouped(list) {
    var groups = (window.Lists ? window.Lists.getGroups('playerActions') : null) ||
      (window.CLUB && window.CLUB.playerActions) || {};
    var out = {};
    (list || []).forEach(function (x) {
      var side = 'Offensive';
      Object.keys(groups).forEach(function (g) {
        if (groups[g].indexOf(x) >= 0) side = sideOf(g).label;
      });
      (out[side] = out[side] || []).push(x);
    });
    return out;
  }
  function paSummary(list) {
    var g = paGrouped(list);
    return Object.keys(g).map(function (k) { return k + ': ' + g[k].join(', '); }).join('\n');
  }

  function pick(list, value, onchange, blank) {
    var sel = el('select');
    sel.appendChild(el('option', { value: '', text: blank || '-' }));
    (list || []).forEach(function (o) {
      var v = typeof o === 'object' ? String(o.v) : o, t = typeof o === 'object' ? o.t : o;
      sel.appendChild(el('option', { value: v, text: t }));
    });
    sel.value = value == null ? '' : String(value);
    sel.addEventListener('change', function () { onchange(sel.value); });
    return sel;
  }

  function actCard(a, i) {
    var C = window.CLUB || {};
    var card = el('div', { class: 'act', 'data-kind': a.kind || 'small' });

    var labInp = el('input', { type: 'text', placeholder: 'Activity name',
      style: 'font-family:var(--display);font-size:16px;text-transform:uppercase;letter-spacing:.05em;border:0;background:transparent;padding:2px 0;flex:1 1 180px;min-width:140px' });
    labInp.value = a.label || '';
    labInp.addEventListener('input', function () { a.label = labInp.value; drawRibbon(); mark(); });

    var slotTag = el('span', { class: 'chip', text: slotLabel(a.slot) });
    var tot = el('span', { class: 'tot', text: actTotal(a) + ' min · BRT ' + brt(a) });
    a._totEl = tot;

    var up = el('button', { class: 'btn ghost sm no-print', text: '\u2191', title: 'Earlier in the session',
      onclick: function () {
        if (i > 0) { session.acts.splice(i - 1, 0, session.acts.splice(i, 1)[0]); renderActs(); mark(); }
      } });
    var dn = el('button', { class: 'btn ghost sm no-print', text: '\u2193', title: 'Later in the session',
      onclick: function () {
        if (i < session.acts.length - 1) { session.acts.splice(i + 1, 0, session.acts.splice(i, 1)[0]); renderActs(); mark(); }
      } });
    var rm = el('button', { class: 'btn warn sm no-print', text: 'Remove',
      onclick: function () {
        /* the diagram goes with the activity. Left behind it belonged to
           nothing and printed at the end under "Other diagrams", so it is
           worth one question before it goes. */
        var st = session.boardStates[a.board];
        if (hasContent(st) && !confirm('Remove ' + (a.label || slotLabel(a.slot)) +
          '?\n\nIts diagram is removed with it.')) return;
        session.acts.splice(i, 1);
        if (st) delete session.boardStates[a.board];
        renderActs(); mark();
      } });

    /* two buttons rather than one asking a question: saving and inserting are
       different intentions and a confirm dialog is a poor way to ask which */
    var saveBtn = el('button', { class: 'btn ghost sm no-print', text: 'Save to library',
      title: 'Keep this activity for any session, on any team',
      onclick: function () { saveToLibrary(i); } });
    var insBtn = el('button', { class: 'btn ghost sm no-print', text: 'Insert',
      title: 'Replace this activity with one from the library',
      onclick: function () { insertFromLibrary(i); } });
    card.appendChild(el('div', { class: 'act-hd' },
      [slotTag, labInp, tot, el('span', { class: 'sp' }), saveBtn, insBtn, up, dn, rm]));

    var bd = el('div', { class: 'act-bd' });

    var top = el('div', { class: 'grid g4' });
    top.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Activity type' }),
      pick(L('activityTypes'), a.type, function (v) { a.type = v; mark(); })]));
    top.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Training load' }),
      pick(L('trainingLoad'), a.load, function (v) { a.load = v; mark(); })]));
    top.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Area of the field' }),
      pick(L('thirds'), a.area, function (v) { a.area = v; mark(); })]));
    top.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Channel' }),
      pick(L('channels'), a.channel, function (v) { a.channel = v; mark(); })]));
    top.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Number of players' }),
      pick(L('numbers'), a.numbers, function (v) { a.numbers = v; renderActs(); mark(); })]));

    /* what the size you have chosen is actually for, and whether the numbers
       underneath match it */
    var gx = ((window.CLUB && window.CLUB.gameSizes) || []).filter(function (y) { return y.key === a.numbers; })[0];
    var gsNote = el('div', { style: 'margin-top:8px' });
    if (gx) {
      gsNote.appendChild(el('p', { style: 'margin:0 0 4px' }, [
        el('span', { class: 'chip ao', text: gx.objective })
      ]));
      gsNote.appendChild(el('p', { class: 'hint', style: 'margin:0;line-height:1.5',
        text: [gx.intensity, gx.duration, gx.recovery, gx.physio, gx.mech, gx.actions].filter(Boolean).join(' \u00b7 ') }));
      if (gx.note) gsNote.appendChild(el('p', { class: 'hint', style: 'margin:4px 0 0;font-style:italic', text: gx.note }));
      var off = [];
      if (num(a.time) && Math.abs(num(a.time) - gx.time) > Math.max(1, gx.time * 0.6)) {
        off.push('the interval is ' + a.time + ' min, this size wants about ' + gx.time);
      }
      if (num(a.rest) && Math.abs(num(a.rest) - gx.rest) > Math.max(0.5, gx.rest * 0.6)) {
        off.push('the rest is ' + a.rest + ' min, this size wants about ' + gx.rest);
      }
      if (off.length) {
        gsNote.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0;color:var(--danger)',
          text: 'Off the shape: ' + off.join('; ') + '.' }));
      }
      gsNote.appendChild(el('button', {
        class: 'btn ghost sm no-print', style: 'margin-top:6px', text: 'Use the numbers this size wants',
        onclick: function () { a.time = gx.time; a.rest = gx.rest; renderActs(); mark(); }
      }));
    }
    bd.appendChild(gsNote);
    bd.appendChild(top);

    var g = el('div', { class: 'grid g2', style: 'margin-top:12px' });

    g.appendChild(ta(a, 'objective', 'Activity objective', 3, 'What this activity is for'));
    g.appendChild(ta(a, 'description', 'Activity description', 4, 'One bullet per line'));
    g.appendChild(ta(a, 'scoringMethods', 'Scoring methods', 4, 'One per line'));
    bd.appendChild(g);

    var areaRow = el('div', { class: 'grid g2', style: 'margin-top:12px' });
    var areaIn = el('input', { type: 'text', placeholder: '32W x 30L (2)' });
    areaIn.value = a.areaSize || '';
    areaIn.addEventListener('input', function () { a.areaSize = areaIn.value; mark(); });
    areaRow.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Area size' }), areaIn]));
    areaRow.appendChild(el('div', { class: 'f' }, [
      el('span', { class: 'eyebrow', text: 'Diagram' }),
      el('div', { class: 'diagrow', id: 'dia' + i })
    ]));
    bd.appendChild(areaRow);

    // timing, in the template's own columns
    var load = el('div', { class: 'loadrow', style: 'margin-top:12px' });
    [['intro', 'Intro'], ['intervals', 'Intervals'], ['time', 'Time'], ['rest', 'Rest'], ['transition', 'Transition']]
      .forEach(function (f) {
        var inp = el('input', { type: 'number', class: 'num', step: '0.5', min: '0' });
        inp.value = a[f[0]] || '';
        inp.addEventListener('input', function () { a[f[0]] = inp.value; refreshTotals(); mark(); });
        load.appendChild(el('label', { class: 'f' }, [el('span', { text: f[1] }), inp]));
      });
    var totInp = el('input', { type: 'number', class: 'num', step: '0.5', min: '0', placeholder: String(autoTotal(a)) });
    totInp.value = a.ttlDur || '';
    totInp.addEventListener('input', function () { a.ttlDur = totInp.value; refreshTotals(); mark(); });
    a._totInp = totInp;
    load.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Total (auto)' }), totInp]));
    bd.appendChild(load);
    bd.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
      text: 'Ball rolling is intervals x time. Total is intro + intervals x time + (intervals - 1) x rest + transition.' }));

    var g2 = el('div', { class: 'grid g2', style: 'margin-top:12px' });
    var conCell = el('div');
    conCell.appendChild(ta(a, 'constraints', 'Activity constraints', 4, 'One per line'));
    conCell.appendChild(el('button', {
      class: 'btn ghost sm no-print', type: 'button', style: 'margin-top:5px', text: 'Add constraints',
      onclick: function () {
        window.Lists.multiPick({
          title: 'Choose constraints', items: L('constraints'), listKey: 'constraints',
          onPick: function (picked) {
            a.constraints = (a.constraints ? a.constraints.replace(/\s*$/, '') + '\n' : '') + picked.join('\n');
            renderActs(); mark();
          }
        });
      }
    }));
    g2.appendChild(conCell);
    var cpCell = el('div');
    cpCell.appendChild(ta(a, 'coachingPoints', 'Key coaching points', 4, 'One per line'));
    cpCell.appendChild(el('button', {
      class: 'btn ghost sm no-print', type: 'button', style: 'margin-top:5px', text: 'Add coaching points',
      onclick: function () {
        window.Lists.multiPick({
          title: 'Choose coaching points', groups: (window.CLUB || {}).coachingPoints,
          onPick: function (picked) {
            a.coachingPoints = (a.coachingPoints ? a.coachingPoints.replace(/\s*$/, '') + '\n' : '') + picked.join('\n');
            renderActs(); mark();
          }
        });
      }
    }));
    g2.appendChild(cpCell);
    bd.appendChild(g2);

    var g3 = el('div', { class: 'grid g3', style: 'margin-top:12px' });
    [['when', 'Coaching interactions (when)', L('when')], ['how', 'Coaching interactions (how)', L('how')],
     ['other', 'Coaching interactions (other)', L('other')]].forEach(function (f) {
      var col = el('div');
      col.appendChild(el('span', { class: 'eyebrow', text: f[1] }));
      col.appendChild(multi(f[2], a[f[0]], function (c) { a[f[0]] = c; renderActs(); mark(); }, f[0]));
      (function (key) {
        col.appendChild(el('button', {
          class: 'btn ghost sm no-print', style: 'margin-top:5px;width:100%;justify-content:center',
          text: '+ Add',
          onclick: function () {
            var v = prompt('New coaching interaction');
            if (!v) return;
            window.Lists.add(key, v);
            a[key] = (a[key] || []).concat([v.trim()]);
            renderActs(); mark();
            S.toast('Added to the list for good.');
          }
        }));
      })(f[0]);
      g3.appendChild(col);
    });
    bd.appendChild(g3);


    card.appendChild(bd);
    return card;
  }

  function slotNum(k) {
    var m = /^a(\d+)$/.exec(k || '');
    return m ? +m[1] : 99;
  }
  /* A slot key the club list does not name still reads as a number rather than
     a bare "Activity", so a fourth activity prints as Activity 4. */
  function slotLabel(k) {
    var sl = ((window.CLUB && window.CLUB.slots) || []).filter(function (x) { return x.key === k; })[0];
    if (sl) return sl.label;
    var n = slotNum(k);
    return n < 99 ? 'Activity ' + n : 'Activity';
  }

  function renderAddSlots() {
    var host = document.getElementById('addSlots');
    if (!host) return;
    host.innerHTML = '';
    ((window.CLUB && window.CLUB.slots) || []).forEach(function (sl) {
      if (session.acts.some(function (a) { return a.slot === sl.key; })) return;
      host.appendChild(el('button', {
        class: 'btn ghost sm', text: 'Add ' + sl.label,
        onclick: function () {
          session.acts.push(Object.assign({ pa: [], when: [], how: [], other: [] }, ACT_TEMPLATES[sl.key]));
          session.acts.sort(function (x, y) { return slotNum(x.slot) - slotNum(y.slot); });
          renderActs(); refreshBoardSelects(); mark();
        }
      }));
    });
    if (!host.children.length) host.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'All three activities are in the session.' }));
  }

  /* A diagram belonging to no activity prints at the end under "Other
     diagrams", which is not where anyone looks for it. Sessions written before
     a removed activity took its diagram with it can still hold one, so it is
     shown here with the activities it could be given to. */
  function renderOrphanDiagrams() {
    var host = document.getElementById('orphanDia');
    if (!host) return;
    host.innerHTML = '';
    var keys = orphanBoards().filter(function (k) { return hasContent(session.boardStates[k]); });
    if (!keys.length) return;
    keys.forEach(function (k) {
      var st = session.boardStates[k];
      var row = el('div', { class: 'act', style: 'border-left-color:var(--flag)' });
      row.appendChild(el('div', { class: 'act-hd' }, [
        el('span', { class: 'lab', text: 'Unassigned diagram' }),
        el('span', { class: 'chip', text: st.frame ? 'picture' : st.objects.length + ' pieces' })
      ]));
      var bd = el('div', { class: 'act-bd' });
      bd.appendChild(el('p', { class: 'hint', style: 'margin:0 0 8px',
        text: 'This one belongs to no activity, so it prints on its own at the end. Give it to an activity or remove it.' }));
      bd.appendChild(el('img', { class: 'thumb', style: 'max-width:230px',
        alt: 'Unassigned diagram', src: window.renderBoardPNG(st, 0.38) }));
      var btns = el('div', { class: 'btnrow', style: 'margin-top:10px' });
      session.acts.forEach(function (a) {
        btns.appendChild(el('button', { class: 'btn ghost sm',
          text: 'Use on ' + (a.label || slotLabel(a.slot)),
          title: hasContent(session.boardStates[a.board])
            ? 'Replaces the diagram already on it' : 'That activity has no diagram yet',
          onclick: function () {
            if (hasContent(session.boardStates[a.board]) &&
                !confirm((a.label || slotLabel(a.slot)) + ' already has a diagram.\n\nReplace it?')) return;
            var old = a.board;
            a.board = String(k);
            if (old !== String(k)) delete session.boardStates[old];
            renderActs(); mark();
          } }));
      });
      btns.appendChild(el('button', { class: 'btn warn sm', text: 'Remove it',
        onclick: function () {
          if (!confirm('Remove this diagram?')) return;
          delete session.boardStates[k];
          renderActs(); mark();
        } }));
      bd.appendChild(btns);
      row.appendChild(bd);
      host.appendChild(row);
    });
    var cold = keys.map(function (k) { return session.boardStates[k]; })
      .filter(function (st) { return st.frame && !window.boardFrameSeen(st.frame); });
    if (cold.length) window.preloadBoardFrames(cold, renderOrphanDiagrams);
  }

  function recalc(a) {
    if (a._totInp) a._totInp.placeholder = String(autoTotal(a));
    refreshTotals();
  }
  function refreshTotals() {
    session.acts.forEach(function (a) {
      if (a._totEl) a._totEl.textContent = actTotal(a) + ' min · BRT ' + brt(a);
      if (a._totInp) a._totInp.placeholder = String(autoTotal(a));
    });
    drawRibbon();
  }

  /* ---------------- board ----------------
     Modal editor with a grouped rail, matching the IPM1 tool.
     Everything we had that IPM1 lacks is kept: mannequin, cone, text
     label, erase, select, undo and redo. */
  var COLORS = ['blue', 'red', 'orange', 'amber', 'white', 'green', 'cyan', 'purple', 'black'];
  var ARROWS = ['\u2196', '\u2191', '\u2197', '\u2190', '\u00b7', '\u2192', '\u2199', '\u2193', '\u2198'];
  var ARROW_DIR = [7, 0, 1, 6, null, 2, 5, 4, 3];
  var editingAct = null;

  function ico(kind, color) {
    var c = window.Board.HEX[color] || color || '#2F6FD0';
    var S2 = 'width="18" height="18" viewBox="0 0 18 18"';
    if (kind === 'tri') return '<svg ' + S2 + '><polygon points="9,2 16,15 2,15" fill="' + c + '"/></svg>';
    if (kind === 'cir') return '<svg ' + S2 + '><circle cx="9" cy="9" r="7" fill="' + c + '"/></svg>';
    if (kind === 'sq') return '<svg ' + S2 + '><rect x="2" y="2" width="14" height="14" rx="2" fill="' + c + '"/></svg>';
    if (kind === 'ball') return '<svg ' + S2 + '><circle cx="9" cy="9" r="7" fill="#fff" stroke="#10202E" stroke-width="1.6"/><circle cx="9" cy="9" r="2.6" fill="#10202E"/></svg>';
    if (kind === 'cone') return '<svg ' + S2 + '><polygon points="9,3 15,14 3,14" fill="#E8721E"/></svg>';
    if (kind === 'man') return '<svg ' + S2 + '><rect x="6" y="2" width="6" height="14" rx="3" fill="#D8DEE4" stroke="#5C7086" stroke-width="1.4"/></svg>';
    if (kind === 'goal') return '<svg ' + S2 + '><path d="M2 13 V6 H16 V13" fill="none" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'minigoal') return '<svg ' + S2 + '><path d="M5 13 V8 H13 V13" fill="none" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'arrow') return '<svg ' + S2 + '><path d="M3 15 L14 4" stroke="#10202E" stroke-width="1.8" stroke-dasharray="3 2"/><path d="M15 3 L10 4.5 L13.5 8 Z" fill="#10202E"/></svg>';
    if (kind === 'pass') return '<svg ' + S2 + '><path d="M3 15 L14 4" stroke="#10202E" stroke-width="1.8"/><path d="M15 3 L10 4.5 L13.5 8 Z" fill="#10202E"/></svg>';
    if (kind === 'dribble') return '<svg ' + S2 + '><path d="M4 15 q3-3 0-5 t0-5" fill="none" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'line') return '<svg ' + S2 + '><path d="M3 15 L15 3" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'dash') return '<svg ' + S2 + '><path d="M3 15 L15 3" stroke="#10202E" stroke-width="1.8" stroke-dasharray="3 3"/></svg>';
    if (kind === 'zone') return '<svg ' + S2 + '><rect x="3" y="4" width="12" height="10" fill="#9EC4E8" stroke="#3C6FA8" stroke-width="1.4"/></svg>';
    if (kind === 'text') return '<svg ' + S2 + '><text x="9" y="14" text-anchor="middle" font-size="13" font-weight="700" fill="#10202E">T</text></svg>';
    if (kind === 'select') return '<svg ' + S2 + '><path d="M4 2 L14 10 L9 10.5 L11 15 L9 16 L7 11.5 L4 14 Z" fill="#10202E"/></svg>';
    if (kind === 'erase') return '<svg ' + S2 + '><rect x="3" y="8" width="12" height="6" rx="1.5" transform="rotate(-35 9 11)" fill="#C8392B"/></svg>';
    return '';
  }

  function railSection(title, count) {
    var h = el('h4', {}, [el('span', { text: title })]);
    if (count != null) h.appendChild(el('span', { class: 'ct', text: String(count) }));
    var sec = el('section');
    sec.appendChild(h);
    return sec;
  }

  function buildRail() {
    if (window.buildBoardRail) window.buildBoardRail(board, 'rail');
  }

  function openBoard(actIndex) {
    var a = session.acts[actIndex];
    if (!a) return;
    editingAct = actIndex;
    currentBoard = +a.board;
    if (!session.boardStates[currentBoard]) session.boardStates[currentBoard] = { field: 'full', objects: [] };
    board.setState(session.boardStates[currentBoard]);
    board.setFrame(session.boardStates[currentBoard].frame || '');
    document.getElementById('boardTitle').textContent =
      'Activity diagram \u2014 ' + slotLabel(a.slot) + (a.label ? ' \u2014 ' + a.label : '');
    buildRail();
    document.getElementById('boardModal').hidden = false;
  }
  function closeBoard(commit) {
    if (commit) {
      var keepFrame = (session.boardStates[currentBoard] || {}).frame || '';
      session.boardStates[currentBoard] = board.getState();
      if (keepFrame) session.boardStates[currentBoard].frame = keepFrame;
    }
    document.getElementById('boardModal').hidden = true;
    editingAct = null;
    refreshBoardSelects();
    if (commit) mark();
  }
  function stashBoard() {
    if (!board || document.getElementById('boardModal').hidden) return;
    /* getState carries the drawing but not the picture under it, so saving or
       printing while the editor is open used to throw the upload away */
    var keepFrame = (session.boardStates[currentBoard] || {}).frame || '';
    session.boardStates[currentBoard] = board.getState();
    if (keepFrame) session.boardStates[currentBoard].frame = keepFrame;
  }
  function switchBoard(n) { /* kept for older links */ }
  function buildBoardTabs() {}

  /* Each activity owns a diagram; the card shows a live thumbnail. */
  function refreshBoardSelects() {
    normalizeBoards();
    var pending = session.acts.filter(function (a) {
      var st = session.boardStates[a.board];
      return st && st.frame && !window.boardFrameSeen(st.frame);
    });
    if (pending.length) {
      window.preloadBoardFrames(pending.map(function (a) { return session.boardStates[a.board]; }),
        function () { refreshBoardSelects(); });
    }
    session.acts.forEach(function (a, i) {
      var host = document.getElementById('dia' + i);
      if (!host) return;
      host.innerHTML = '';
      var st = session.boardStates[a.board];
      var img = el('img', { class: 'thumb', alt: 'Diagram for ' + (a.label || slotLabel(a.slot)),
        src: window.renderBoardPNG(st, 0.42) });
      img.addEventListener('click', function () { openBoard(i); });
      host.appendChild(img);
      host.appendChild(el('div', { class: 'btnrow no-print' }, [
        el('button', { class: 'btn ghost sm', text: st.objects.length || st.frame ? 'Edit diagram' : 'Draw diagram',
          onclick: function () { openBoard(i); } }),
        el('button', { class: 'btn ghost sm', title: 'Save this diagram as a picture', text: 'Download',
          onclick: function () {
            var a2 = document.createElement('a');
            a2.href = window.renderBoardPNG(st, 2);
            a2.download = ((a.label || slotLabel(a.slot)) + '.png').replace(/[^\w.-]+/g, '_');
            document.body.appendChild(a2); a2.click(); a2.remove();
          } }),
        el('button', { class: 'btn ghost sm', title: 'Use a picture instead of drawing', text: 'Upload',
          onclick: function () {
            var inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = function () {
              var f = inp.files && inp.files[0];
              if (!f) return;
              var r = new FileReader();
              r.onload = function () {
                st.field = 'clip';
                st.frame = r.result;
                session.boardStates[a.board] = st;
                mark();
                /* decode before redrawing, so the thumbnail and the printed
                   sheet show the picture rather than an empty board */
                window.preloadBoardFrames([st], function () {
                  refreshBoardSelects();
                  S.toast('Picture set as the diagram for ' + (a.label || slotLabel(a.slot)) + '.');
                });
              };
              r.readAsDataURL(f);
            };
            inp.click();
          } }),
        st.frame ? el('button', { class: 'btn warn sm', title: 'Take the picture off, keep anything drawn on it',
          text: 'Remove picture',
          onclick: function () {
            if (!confirm('Remove the uploaded picture?\n\nAnything you drew on top of it is kept.')) return;
            delete st.frame;
            if (!st.objects.length) st.field = 'full';
            session.boardStates[a.board] = st;
            refreshBoardSelects(); mark();
          } }) : null,
        el('span', { class: 'hint', text: st.objects.length ? st.objects.length + ' pieces' : (st.frame ? 'picture' : 'empty') })
      ]));
    });
  }

  /* ---------------- binding ---------------- */
  function bind() {
    TEXT_FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (!n) return;
      if (k === 'squad') return;   // handled by fillSquadSelect
      n.addEventListener('input', function () {
        session[k] = n.value;
        if (k === 'date') ctx();
        if (k === 'coach') S.setPref('coach', n.value);
        if (k === 'duration') drawRibbon();
        mark();
      });
      n.addEventListener('change', function () {
        session[k] = n.value;
        if (k === 'moment' || k === 'phase') cascade(k);
        if (k === 'principleCode') cascade('principle');
        if (k === 'date') { ctx(); renderReadiness(); }
        if (k === 'level') renderLevel();
        if (k === 'squad') renderKeyPlayers();
        mark();
      });
    });
  }

  function toForm() {
    TEXT_FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (n && k !== 'squad') n.value = session[k] == null ? '' : session[k];
    });
    fillSquadSelect();
    fillClubSelects();
    cascade('load');
    renderKPIs();
    renderPA();
    renderLevel();
    renderComponents();
    renderInstanceCheck();
    renderStyleNote();
    renderKeyPlayers();
    renderReadiness();
    ctx();
    renderActs();
    currentBoard = +Object.keys(session.boardStates).sort(function (a, b) { return +a - +b; })[0] || 1;
    board.setState(session.boardStates[currentBoard]);
    refreshBoardSelects();
  }

  function mark() {
    dirty = true;
    /* editing a submitted session puts it back in draft: what is published
       should always be the version the coach last signed off on */
    if (session.status === 'complete') {
      session.status = 'draft';
      delete session.submittedAt;
      S.toast('Edited, so this is back in draft. Submit it again when you are done.');
    }
    document.getElementById('saveState').textContent = 'Unsaved changes';
    renderStatus();
  }
  function clean(msg) {
    dirty = false;
    document.getElementById('saveState').textContent = msg || ('Saved ' + new Date().toLocaleTimeString());
    renderStatus();
  }

  /* ---------------- draft / complete ----------------
     Saves and autosaves leave a session in draft. Only Submit marks it
     complete, and only a complete session counts as written anywhere else
     in the app. */
  function isComplete() { return session.status === 'complete'; }
  function renderStatus() {
    var chip = document.getElementById('statusChip');
    var btn = document.getElementById('btnSubmit');
    var done = isComplete();
    if (chip) {
      chip.className = 'chip ' + (done ? 'ao' : 'off');
      chip.textContent = done ? 'Complete' : 'Draft';
      chip.title = done
        ? 'Submitted' + (session.submittedAt ? ' ' + new Date(session.submittedAt).toLocaleString() : '') +
          '. Editing it puts it back in draft.'
        : 'Saved as a draft. Submit it when the session is finished.';
    }
    var sv = document.getElementById('btnSave');
    if (sv) sv.textContent = done ? 'Save' : 'Save draft';
    if (btn) {
      btn.textContent = done ? 'Submitted \u2713' : 'Submit session';
      btn.className = 'btn ' + (done ? 'ghost sm' : 'turf');
      btn.disabled = !!done;
      btn.title = done ? 'Nothing to submit: this session is complete.'
        : 'Mark this session complete so it counts as written on the plan.';
    }
  }

  /* what is missing before this can honestly be called finished */
  function submitGaps() {
    var gaps = [];
    if (!session.date) gaps.push('a date');
    if (!session.squad) gaps.push('a plan');
    if (!session.principleCode) gaps.push('a principle');
    if (!session.focus && !session.objectives) gaps.push('a focus or an objective');
    var acts = (session.acts || []).filter(function (a) {
      return (a.label || a.description || a.objective || '').trim();
    });
    if (!acts.length) gaps.push('at least one activity with something written in it');
    return gaps;
  }

  function submit() {
    if (session.library) { S.toast('This one is from the library. Save it first to make an editable copy.'); return; }
    var gaps = submitGaps();
    if (gaps.length && !confirm('This session still has no ' + gaps.join(', no ') + '.\n\n' +
      'Submit it anyway and count it as complete?')) return;
    session.status = 'complete';
    session.submittedAt = new Date().toISOString();
    save(true);
    S.toast('Session submitted. It counts as complete on the periodization plan.');
  }

  /* ---------------- save / open ---------------- */
  function save(quiet) {
    stashBoard();
    var copy = strip();
    if (!S.saveSession(copy)) return;
    S.setPlan(session.squad, session.date, {
      sessionId: session.id,
      principle: session.principleCode,
      moment: session.moment,
      phase: session.phase
    });
    S.setPref('lastSession', session.id);
    clean();
    if (!quiet) S.toast(isComplete()
      ? 'Session saved. Still marked complete.'
      : 'Draft saved and linked to the periodization plan. Submit it when the session is done.');
    ctx();
  }

  function strip() {
    var c = JSON.parse(JSON.stringify(session, function (k, v) { return k.charAt(0) === '_' ? undefined : v; }));
    return c;
  }

  function openPicker() {
    var list = S.sessionList();
    if (!list.length) { S.toast('No saved sessions yet.'); return; }
    var back = el('div', {
      style: 'position:fixed;inset:0;background:rgba(10,23,38,.55);z-index:150;display:flex;align-items:center;justify-content:center;padding:20px',
      onclick: function (e) { if (e.target === back) back.remove(); }
    });
    var panel = el('div', { class: 'card', style: 'max-width:620px;width:100%;max-height:74vh;overflow:auto' });
    panel.appendChild(el('div', { class: 'card-hd' }, [el('h2', { text: 'Open a session' })]));
    var bd = el('div', { class: 'card-bd' });
    var ul = el('ul', { class: 'list' });
    list.forEach(function (s) {
      var p = S.principle(s.principleCode);
      var kids = [
        el('span', { class: 'chip ' + (s.library ? '' : 'ao'), text: s.library ? 'Library' : 'Mine' }),
        el('span', { class: 'chip ' + S.statusChip(s), text: S.statusLabel(s) }),
        el('div', { class: 'grow' }, [
          el('div', { class: 'ttl', text: S.fmt(s.date) + ' · ' + S.planLabel(s.squad) + (p ? ' · ' + p.code + ' ' + p.name : '') }),
          el('div', { class: 'sub', text: (s.cycleObj || 'No cycle objective').slice(0, 78) })
        ]),
        el('button', { class: 'btn sm', text: 'Open', onclick: function () { load(s.id); back.remove(); } })
      ];
      if (!s.library) {
        kids.push(el('button', { class: 'btn warn sm', text: 'Delete', onclick: function () {
          if (confirm('Delete this session?')) { S.deleteSession(s.id); back.remove(); openPicker(); }
        } }));
      }
      ul.appendChild(el('li', {}, kids));
    });
    bd.appendChild(ul); panel.appendChild(bd); back.appendChild(panel);
    document.body.appendChild(back);
  }

  function load(id) {
    var s = S.getSession(id);
    if (!s) return;
    session = migrateActs(Object.assign(blank(), s));
    if (!session.boardStates || !Object.keys(session.boardStates).length) session.boardStates = { 1: { field: 'full', objects: [] } };
    normalizeBoards();
    toForm();
    if (!s.library) S.setPref('lastSession', s.id);
    clean(s.library ? 'Opened from the library' : (S.isComplete(s) ? 'Opened · complete' : 'Opened · draft'));
    if (s.library) {
      S.toast('This one is from the library. Saving makes an editable copy in this browser.');
      session.library = false;
      session.id = S.newId();
    }
  }

  /* ---------------- import / export ----------------
     Export is a superset of the IPM1 shape so files move both ways. */
  function exportJSON() {
    stashBoard();
    var d = S.dayMerged(session.squad, session.date) || {};
    var diagrams = {};
    Object.keys(session.boardStates).forEach(function (k) {
      diagrams[k] = window.renderBoardPNG(session.boardStates[k], 1);
    });
    var p = S.principle(session.principleCode);
    var out = {
      coach: session.coach, date: session.date, team: session.squad,
      duration: session.duration + ' min', cogLoad: session.cogLoad, physLoad: session.physLoad,
      fp: session.fp, gk: session.gk,
      cycleObj: session.cycleObj, igs: session.igs,
      principle: p ? label(p) : session.principleCode,
      strategy: session.strategy, learningPlan: session.learningPlan, instances: session.instances,
      /* the actions are the desired behaviors now, so the export sends them
         under the name the course sheet uses */
      desBehav: (function () {
        var g = paGrouped(session.pa);
        return Object.keys(g).map(function (k) { return k + ': ' + g[k].join(', '); }).join('\n');
      })(),
      coachInt: session.acts.map(function (a) {
        return (a.when || []).concat(a.how || [], a.other || []).join(' · ');
      }).filter(Boolean).join('\n'),

      acts: session.acts.map(function (a) {
        var o = {}; ACT_KEYS.forEach(function (k) { o[k] = a[k] == null ? '' : a[k]; });
        o.ttlDur = String(actTotal(a));
        return o;
      }),
      diagrams: diagrams,
      boardStates: session.boardStates,
      sessionBoard: {
        version: 1, id: session.id, squad: session.squad,
        principleCode: session.principleCode, moment: session.moment, phase: session.phase,
        subs: session.subs,
        focus: session.focus, objectives: session.objectives,
        method: session.method, location: session.location,
        primaryPlayers: session.primaryPlayers, secondaryPlayers: session.secondaryPlayers,
        availability: session.availability, ready: session.ready,
        playerActions: (session.pa || []).filter(Boolean),
        brt: sessionBRT(),
        block: d.block || '', week: d.week || '', gd: d.gd || '', rpe: d.rpe || '',
        plannedMinutes: sessionTotal(), bookedMinutes: num(session.duration)
      }
    };
    S.download('Session_' + session.squad + '_' + session.date + '.json', JSON.stringify(out, null, 1));
  }

  function importJSON(text) {
    var j;
    try { j = JSON.parse(text); } catch (e) { S.toast('That file is not valid JSON.'); return; }
    var sb = j.sessionBoard || {};
    var s = blank();
    s.id = sb.id || S.newId();
    s.coach = j.coach || s.coach;
    s.date = normDate(j.date) || s.date;
    s.squad = sb.squad || mapSquad(j.team) || s.squad;
    s.duration = String(parseInt(j.duration, 10) || 75);
    ['cogLoad', 'physLoad', 'fp', 'gk', 'cycleObj', 'igs', 'strategy',
      'learningPlan', 'instances'].forEach(function (k) {
        if (j[k] != null) s[k] = j[k];
      });
    s.focus = sb.focus || '';
    s.area = sb.area || '';
    s.numbers = sb.numbers || '';
    s.pa = (sb.playerActions || []).filter(Boolean);
    ['objectives', 'method', 'location', 'primaryPlayers', 'secondaryPlayers', 'availability'].forEach(function (k) {
      if (sb[k]) s[k] = sb[k];
    });
    s.ready = sb.ready || {};
    s.upo = Array.isArray(j.upo) ? j.upo.join('\n') : (j.upo || '');
    s.principleCode = sb.principleCode || codeFromText(j.principle);
    s.cue = sb.cue || '';
    s.phase = sb.phase || '';
    s.subs = sb.subs || [];
    if (Array.isArray(j.acts) && j.acts.length) {
      s.acts = j.acts.map(function (a, i) {
        var o = {}; ACT_KEYS.forEach(function (k) { o[k] = a[k] == null ? '' : a[k]; });
        o.kind = (a.kind && a.kind !== 'warmup') ? a.kind : (/game/i.test(a.label || '') ? 'game' : 'small');
        o.slot = 'a' + (i + 1);
        o.pa = Array.isArray(a.pa) ? a.pa.filter(Boolean) : [];
        o.when = a.when || []; o.how = a.how || []; o.other = a.other || [];
        return o;
      });
    }
    if (j.boardStates && Object.keys(j.boardStates).length) s.boardStates = j.boardStates;
    session = migrateActs(s);
    normalizeBoards();
    toForm(); mark();
    S.toast('Imported. Nothing is stored until you save.');
  }
  function mapSquad(t) {
    if (!t) return '';
    if (/13/.test(t)) return 'U13';
    if (/19|20/.test(t)) return 'U19';
    return '';
  }
  function codeFromText(t) {
    var m = /((?:IP|OP|TR)\d+(?:\.\d+)?)/.exec(t || '');
    return m ? m[1] : '';
  }
  function normDate(d) {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);
    if (m) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return m[3] + '-' + p(+m[1]) + '-' + p(+m[2]); }
    return '';
  }

  /* ---------------- the activity library ----------------
     An activity is worth keeping on its own, not only inside the session it was
     written for. The library is not scoped to a team or a season, so a rondo
     written for the U13s in October can be dropped into a U19 session in March. */
  var AK = 'ncfc.activities.v1';
  function libAll() {
    try {
      var d = JSON.parse(localStorage.getItem(AK) || '{}');
      return Object.keys(d).map(function (k) { return d[k]; })
        .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    } catch (e) { return []; }
  }
  function libSave(entry) {
    var d;
    try { d = JSON.parse(localStorage.getItem(AK) || '{}'); } catch (e) { d = {}; }
    d[entry.id] = entry;
    try { localStorage.setItem(AK, JSON.stringify(d)); return true; }
    catch (e) { S.toast('Could not save. Storage may be full.'); return false; }
  }
  function libRemove(id) {
    var d;
    try { d = JSON.parse(localStorage.getItem(AK) || '{}'); } catch (e) { d = {}; }
    delete d[id];
    try { localStorage.setItem(AK, JSON.stringify(d)); } catch (e) {}
  }

  function saveToLibrary(i) {
    var a = session.acts[i];
    var st = session.boardStates[a.board];
    var hasDia = !!(st && (st.objects.length || st.frame));

    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var card = el('div', { class: 'card', style: 'max-width:460px;width:100%' });
    card.appendChild(el('div', { class: 'card-hd' }, [el('h2', { text: 'Save to the library' })]));
    var bd = el('div', { class: 'card-bd' });

    var name = el('input', { type: 'text' });
    name.value = a.label || slotLabel(a.slot);
    var picked = session.moment ? [session.moment] : [];
    var thBox = el('div', { class: 'subs', style: 'max-height:180px' });
    ((window.Lists ? window.Lists.get('themes') : null) || (window.CLUB && window.CLUB.themes) || [])
      .forEach(function (t) {
        var cb = el('input', { type: 'checkbox' });
        cb.checked = picked.indexOf(t) >= 0;
        cb.addEventListener('change', function () {
          var i = picked.indexOf(t);
          if (cb.checked && i < 0) picked.push(t);
          if (!cb.checked && i >= 0) picked.splice(i, 1);
        });
        thBox.appendChild(el('label', {}, [cb, el('span', { text: t })]));
      });
    var tags = el('input', { type: 'text', placeholder: 'rondo, pressing, warm-up' });
    var withDia = el('input', { type: 'checkbox' });
    withDia.checked = hasDia;
    withDia.disabled = !hasDia;

    bd.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Name it' }), name]));
    bd.appendChild(el('div', { style: 'margin-top:12px' }, [
      el('span', { class: 'eyebrow', text: 'What it can be used for' }), thBox,
      el('p', { class: 'hint', style: 'margin-top:4px',
        text: 'Tick every topic it works for, not just this one. The moment this session is in is ticked already.' })]));
    bd.appendChild(el('label', { class: 'f', style: 'margin-top:10px' }, [
      el('span', { text: 'Tags, so you can find it later' }), tags]));
    bd.appendChild(el('label', { class: 'switchrow', style: 'margin-top:12px' }, [
      withDia, el('span', { text: hasDia ? 'Save the diagram with it' : 'No diagram on this activity' })]));

    var summary = [a.type, a.numbers, a.areaSize,
      a.intervals && (a.intervals + ' x ' + a.time + ' min')].filter(Boolean).join('  \u00b7  ');
    bd.appendChild(el('p', { class: 'hint', style: 'margin-top:12px',
      text: 'Saving keeps the timing, area, numbers, description, constraints, coaching points and ' +
        'interactions' + (hasDia && withDia.checked ? ' and the diagram' : '') + '. ' + (summary || '') }));

    bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:16px' }, [
      el('button', { class: 'btn turf', text: 'Save it', onclick: function () {
        if (!name.value.trim()) { S.toast('Give it a name.'); return; }
        var entry = {
          id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: name.value.trim(),
          themes: picked.slice(),
          tags: tags.value.trim(),
          from: S.planLabel(session.squad) + ', ' + S.fmt(session.date),
          principle: session.principleCode || '',
          moment: session.moment || '',
          act: JSON.parse(JSON.stringify(a)),
          board: (hasDia && withDia.checked) ? JSON.parse(JSON.stringify(st)) : null
        };
        delete entry.act.board;
        back.remove();
        if (libSave(entry)) {
          S.toast('"' + entry.name + '" is in the library, for every session on every team.');
        }
      } }),
      el('button', { class: 'btn ghost', text: 'Cancel', onclick: function () { back.remove(); } })
    ]));
    card.appendChild(bd); back.appendChild(card);
    document.body.appendChild(back);
    name.focus();
    name.select();
  }

  function insertFromLibrary(i) {
    var list = libAll();
    if (!list.length) {
      S.toast('Nothing in the library yet. Save an activity first.');
      return;
    }
    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var card = el('div', { class: 'card', style: 'max-width:640px;width:100%;max-height:86vh;display:flex;flex-direction:column' });
    card.appendChild(el('div', { class: 'card-hd' }, [
      el('h2', { text: 'Activity library' }),
      el('p', { class: 'hint', style: 'margin-left:auto', text: list.length + ' saved' })
    ]));
    var bd = el('div', { class: 'card-bd', style: 'overflow:auto;flex:1' });
    var search = el('input', { type: 'text', placeholder: 'Filter by name, theme or where it came from' });
    bd.appendChild(el('label', { class: 'f', style: 'margin-bottom:8px' }, [search]));

    /* An activity that serves four topics is listed under four headings, which
       is right when you are hunting by topic and repetitive when you are not. */
    var once = true;
    var onceCb = el('input', { type: 'checkbox' });
    onceCb.checked = once;
    var host = el('div');
    onceCb.addEventListener('change', function () { once = onceCb.checked; draw(search.value); });
    bd.appendChild(el('label', { class: 'switchrow', style: 'margin-bottom:10px' }, [
      onceCb, el('span', { text: 'Show each activity once' })
    ]));
    bd.appendChild(host);

    function draw(q) {
      host.innerHTML = '';
      var shown = list.filter(function (x) {
        if (!q) return true;
        var hay = [x.name, x.tags, themesFor(x).join(' '), x.principle, x.moment, x.from,
          x.act.type, x.act.description].join(' ').toLowerCase();
        return hay.indexOf(q.toLowerCase()) >= 0;
      });
      if (!shown.length) { host.appendChild(el('p', { class: 'hint', text: 'Nothing matches.' })); return; }
      if (once) {
        shown.slice().sort(function (a2, b2) { return (a2.name || '').localeCompare(b2.name || ''); })
          .forEach(function (x) { host.appendChild(entryRow(x)); });
      } else {
        var groups = {};
        shown.forEach(function (x) {
          themesFor(x).forEach(function (k) { (groups[k] = groups[k] || []).push(x); });
        });
        Object.keys(groups).sort().forEach(function (g) {
          host.appendChild(el('p', { class: 'eyebrow', style: 'margin:12px 0 6px',
            text: g + '  (' + groups[g].length + ')' }));
          groups[g].forEach(function (x) { host.appendChild(entryRow(x)); });
        });
      }

      function themesFor(x) {
        return window.Library ? window.Library.themesOf(x)
          : [x.theme || x.moment || 'Not yet themed'];
      }
      function entryRow(x) {
        var p2 = S.principle(x.principle);
        var row = el('div', { class: 'act', style: 'border-left-color:var(--turf)' });
        var hd = [el('span', { class: 'lab', text: x.name })];
        if (once) {
          themesFor(x).forEach(function (t) { hd.push(el('span', { class: 'chip', text: t })); });
        }
        row.appendChild(el('div', { class: 'act-hd' }, hd.concat([
          x.act.type ? el('span', { class: 'chip', text: x.act.type }) : null,
          p2 ? el('span', { class: 'chip ' + S.momentKey(p2.moment), text: p2.clubCode }) : null,
          x.board ? el('span', { class: 'chip', text: 'diagram' }) : null,
          el('span', { class: 'sp' }),
          el('button', { class: 'btn turf sm', text: 'Insert here', onclick: function () {
            var a = session.acts[i];
            var boardId = a.board;
            var slot = a.slot;
            session.acts[i] = JSON.parse(JSON.stringify(x.act));
            session.acts[i].slot = slot;
            session.acts[i].board = boardId;
            if (x.board) session.boardStates[boardId] = JSON.parse(JSON.stringify(x.board));
            back.remove();
            renderActs(); refreshBoardSelects(); mark();
            S.toast('"' + x.name + '" inserted. Edit it here without touching the library copy.');
          } }),
          el('button', { class: 'btn warn sm', text: 'Delete', onclick: function () {
            if (!confirm('Delete "' + x.name + '" from the library?')) return;
            libRemove(x.id);
            list = libAll();
            draw(search.value);
          } })
        ])));
        var meta = [once ? '' : themesFor(x).join(', '), x.tags, x.from && 'from ' + x.from,
          x.act.intervals && x.act.intervals + ' x ' + x.act.time + ' min',
          x.act.numbers, x.act.areaSize].filter(Boolean).join('  \u00b7  ');
        row.appendChild(el('div', { class: 'act-bd' }, [
          el('p', { class: 'hint', style: 'margin:0 0 4px', text: meta }),
          x.act.description ? el('p', { style: 'margin:0;font-size:13px;white-space:pre-wrap',
            text: x.act.description.split('\n').slice(0, 2).join('\n') }) : null
        ]));
        return row;
      }
    }
    var t;
    search.addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(function () { draw(search.value); }, 150);
    });
    draw('');
    card.appendChild(bd);
    card.appendChild(el('div', { class: 'card-bd', style: 'border-top:1px solid var(--chalk-3)' }, [
      el('p', { class: 'hint', style: 'margin:0 0 8px',
        text: 'Inserting replaces this activity with a copy. Editing the copy does not change the library, ' +
          'and the library is not tied to a team or a season.' }),
      el('div', { class: 'btnrow' }, [
        el('a', { class: 'btn ghost sm', href: 'library.html', text: 'Open the whole library' }),
        el('button', { class: 'btn ghost', text: 'Close', onclick: function () { back.remove(); } })
      ])
    ]));
    back.appendChild(card);
    document.body.appendChild(back);
    search.focus();
  }

  /* ---------------- print ----------------
     Two layouts. Full detail is one activity per block and runs to several
     pages. One page is landscape, everything visible at once, text clamped so
     it cannot push onto a second sheet. */
  function clamp(t, n) {
    t = (t || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1) + '\u2026' : t;
  }
  function lines(t, n, per) {
    return (t || '').split('\n').filter(Boolean).slice(0, n)
      .map(function (x) { return clamp(x, per || 90); });
  }

  function pageStyle(landscape) {
    var id = 'pageSize', old = document.getElementById(id);
    if (old) old.remove();
    var st2 = document.createElement('style');
    st2.id = id;
    st2.textContent = '@page{size:' + (landscape ? 'letter landscape' : 'letter portrait') + ';margin:9mm}';
    document.head.appendChild(st2);
  }

  function buildOnePage() {
    var p = S.principle(session.principleCode);
    var d = S.dayMerged(session.squad, session.date) || {};
    var pLabel = p ? '[' + p.clubCode + '] ' + (p.clubName || p.name) : (session.principleCode || '');
    var allSubs = window.Lists ? window.Lists.subsFor(session.principleCode) : (p ? p.subs : []);
    var subTxt = (session.subs || []).map(function (c) {
      var sp = allSubs.filter(function (x) { return x.code === c; })[0];
      return c + ' ' + (sp ? sp.text : '');
    });
    var pag = paGrouped(session.pa);

    function cell(label, value) {
      return '<div><b>' + esc(label) + '</b>' + esc(clamp(value, 60) || '-') + '</div>';
    }
    function sec(title, inner) {
      return '<section><h3>' + esc(title) + '</h3>' + inner + '</section>';
    }
    function ul(arr) {
      return arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p>-</p>';
    }

    var html =
      '<div class="op-hd"><h1>' + esc(S.planLabel(session.squad)) + ' \u00b7 ' + esc(S.dow(session.date)) + ' ' + esc(S.fmt(session.date)) + '</h1>' +
      '<span class="sub">' + esc([isComplete() ? '' : 'DRAFT', session.coach, session.location, d.block, d.gd,
        session.duration + ' min', 'BRT ' + sessionBRT() + ' min'].filter(Boolean).join('  \u00b7  ')) + '</span></div>' +

      '<div class="op-band">' +
        cell('Principle', pLabel) +
        cell('Moment / phase', [session.moment, session.phase].filter(Boolean).join(' \u00b7 ')) +
        cell('Method', session.method) +
        cell('Training load', session.physLoad) +
        cell('Cognitive load', session.cogLoad) +
      '</div>' +

      '<div class="op-mid">' +
        sec('Sub-principles to work on', subTxt.length
          ? '<ul>' + subTxt.slice(0, 6).map(function (x) {
              var m = /^(\S+)\s+([\s\S]*)$/.exec(x);
              return '<li><strong>' + esc(m ? m[1] : x) + '</strong> ' + esc(m ? clamp(m[2], 96) : '') + '</li>';
            }).join('') + '</ul>'
          : '<p>-</p>') +
        sec('Team intentions and objectives', ul(lines(session.focus, 3, 78).concat(lines(session.objectives, 3, 78)))) +
        sec('Player actions', Object.keys(pag).length
          ? Object.keys(pag).map(function (k) {
              return '<p class="op-k">' + esc(k) + '</p>' + ul(pag[k].slice(0, 5));
            }).join('')
          : '<p>-</p>') +
      '</div>' +

      '<div class="op-acts">' + session.acts.map(function (a) {
        var ast = a.board ? session.boardStates[a.board] : null;
        var img = hasContent(ast) ? '<img src="' + window.renderBoardPNG(ast, 0.55) + '">' : '';
        var apa = paGrouped(a.pa);
        return '<section><h3>' + esc(clamp((a.label || slotLabel(a.slot)), 34)) + '</h3>' +
          '<p><strong>' + esc(a.type || '') + '</strong>' + (a.load ? ' \u00b7 ' + esc(clamp(a.load, 22)) : '') + '</p>' +
          '<table class="op-t"><tr><td>Intro</td><td>Int</td><td>Time</td><td>Rest</td><td>Trans</td></tr>' +
          '<tr><td>' + (a.intro || 0) + '</td><td>' + (a.intervals || 0) + '</td><td>' + (a.time || 0) +
          '</td><td>' + (a.rest || 0) + '</td><td>' + (a.transition || 0) + '</td></tr></table>' +
          '<p><strong>' + actTotal(a) + ' min</strong>, BRT ' + brt(a) +
          (a.areaSize || a.area ? ' \u00b7 ' + esc(clamp([a.areaSize, a.area, a.channel, a.numbers].filter(Boolean).join(' '), 40)) : '') + '</p>' +
          (a.objective ? '<p class="op-k">Objective</p>' + ul(lines(a.objective, 2, 64)) : '') +
          (a.description ? '<p class="op-k">Set-up</p>' + ul(lines(a.description, 3, 64)) : '') +
          (Object.keys(apa).length ? '<p class="op-k">Actions</p><p>' +
            esc(clamp(Object.keys(apa).map(function (k) { return apa[k].join(', '); }).join(' | '), 90)) + '</p>' : '') +
          (a.constraints ? '<p class="op-k">Constraints</p>' + ul(lines(a.constraints, 2, 64)) : '') +
          (a.coachingPoints ? '<p class="op-k">Coaching points</p>' + ul(lines(a.coachingPoints, 3, 64)) : '') +
          ((a.when || []).length || (a.how || []).length
            ? '<p class="op-k">Interactions</p><p>' + esc(clamp((a.when || []).concat(a.how || []).join(', '), 78)) + '</p>' : '') +
          img + '</section>';
      }).join('') + '</div>' +

      '<div class="op-foot">' +
        sec('Instances to look for', ul(lines(session.instances, 4, 74))) +

        sec('Success criteria', ul((session.kpis || []).map(function (t) {
          var def = window.KPI && window.KPI.get(t.id);
          if (!def) return '';
          var tl = window.KPI.targetLabel(t, def.unit);
          return clamp(def.category, 48) + (tl ? ' \u2014 ' + tl : '');
        }).filter(Boolean))) +
      '</div>';

    document.getElementById('printOnly').innerHTML = html;
    document.body.classList.add('has-printsheet', 'onepage');
    pageStyle(true);
  }

  function buildPrint() {
    stashBoard();
    normalizeBoards();
    var p = S.principle(session.principleCode);
    var d = S.dayMerged(session.squad, session.date) || {};
    var rows = function (pairs) {
      return pairs.filter(function (x) { return x[1]; }).map(function (x) {
        return '<tr><th style="text-align:left;width:170px;padding:3px 8px 3px 0;vertical-align:top;font-weight:600">' +
          esc(x[0]) + '</th><td style="padding:3px 0;white-space:pre-wrap;vertical-align:top">' + esc(x[1]) + '</td></tr>';
      }).join('');
    };
    var allSubs2 = window.Lists ? window.Lists.subsFor(session.principleCode) : (p ? p.subs : []);
    var subTxt = (session.subs || []).map(function (c) {
      var sp = allSubs2.filter(function (x) { return x.code === c; })[0];
      return c + ' ' + (sp ? sp.text : '');
    }).join('\n');

    var html =
      '<h1 style="margin:0 0 2pt">Training session · ' + esc(S.planLabel(session.squad)) + ' · ' + esc(S.fmt(session.date)) + '</h1>' +
      '<p style="margin:0 0 10pt;font-size:9.5pt">' + esc([isComplete() ? '' : 'DRAFT', session.coach, session.location, d.block, d.gd,
        session.duration + ' min planned', 'BRT ' + sessionBRT() + ' min'].filter(Boolean).join(' · ')) + '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:10pt">' + rows([
        ['Session method', session.method],
        ['Principle', p ? label(p) + (p.name !== p.clubName ? '  (' + p.name + ')' : '') : session.principleCode],
        ['Moment / phase', [session.moment, session.phase].filter(Boolean).join(' · ')],

        ['Team intentions', session.focus],
        ['Training objectives', session.objectives],
        ['Player actions', paSummary(session.pa)],
        ['Cycle objective', session.cycleObj],
        ['In-game scenario', session.igs],
        ['Level of learning', session.level],
        ['Instance to identify', session.instanceName],
        ['Components', (session.components || []).map(function (c, i) {
          if (!c.text) return '';
          return (i + 1) + '. ' + c.text +
            (c.filter ? '\n     filter: ' + c.filter : '') +
            (c.missing ? '\n     if missing: ' + c.missing : '');
        }).filter(Boolean).join('\n')],
        ['Style of play for this moment', (function () {
          try {
            var d = JSON.parse(localStorage.getItem('ncfc.gamemodel.v1') || '{}') || {};
            return [d.identity, session.moment && d.style && d.style[session.moment]].filter(Boolean).join(' \u2014 ');
          } catch (e) { return ''; }
        })()],
        ['Shape in possession', session.shapeIn],
        ['Shape out of possession', session.shapeOut],
        ['In possession intention', session.intentIn],
        ['Out of possession intention', session.intentOut],
        ['Specific assignments', session.assign],
        ['Key players', (session.keyPlayers || []).map(function (k) {
          return [k.num, k.pos, k.name, k.why].filter(Boolean).join(' \u00b7 ');
        }).filter(Boolean).join('\n')],
        ['Strategy', session.strategy],
        ['Learning plan', session.learningPlan],
        ['Instances', session.instances],
        ['Success criteria', (session.kpis || []).map(function (t) {
          var def = window.KPI && window.KPI.get(t.id);
          if (!def) return '';
          var tl = window.KPI.targetLabel(t, def.unit);
          return def.category + (tl ? ' \u2014 target ' + tl : ' \u2014 no target set');
        }).filter(Boolean).join('\n')],
        ['Training load', session.physLoad],
        ['Cognitive load', session.cogLoad],
        ['Primary players', session.primaryPlayers],
        ['Secondary players', session.secondaryPlayers],
        ['Availability', session.availability],
        ['Readiness', readinessDetail().polled
          ? readinessScore().toFixed(1) + ' of 5, from ' + readinessDetail().counted + ' player(s) present' : ''],
        ['Players', [session.fp ? session.fp + ' field' : '', session.gk ? session.gk + ' GK' : ''].filter(Boolean).join(' · ')]
      ]) + '</table>' +
      (subTxt ? '<div style="margin-top:8pt;border:1px solid #143250">' +
        '<div style="background:#143250;color:#fff;padding:3pt 5pt;font-weight:600">Sub-principles to work on</div>' +
        '<div style="padding:5pt">' + subTxt.split('\n').map(function (line) {
          var m = /^(\S+)\s+([\s\S]*)$/.exec(line);
          return '<p style="margin:0 0 4pt"><strong style="font-family:monospace">' +
            esc(m ? m[1] : line) + '</strong>&nbsp; ' + esc(m ? m[2] : '') + '</p>';
        }).join('') + '</div></div>' : '');

    /* One block per activity, kept whole. The diagram sits beside its own
       information rather than on a page of its own, and two blocks share a
       sheet whenever they fit. */
    session.acts.forEach(function (a) {
      var st = session.boardStates[a.board];
      var hasDia = hasContent(st);
      var img = hasDia ? '<img class="pa-dia" src="' + window.renderBoardPNG(st, 1) + '">' : '';
      html += '<section class="pa">' +
        '<h2>' + esc(slotLabel(a.slot)) + (a.label ? ' \u00b7 ' + esc(a.label) : '') +
        '<span class="pa-t">' + actTotal(a) + ' min \u00b7 BRT ' + brt(a) + '</span></h2>' +
        '<div class="pa-body' + (hasDia ? ' pa-split' : '') + '">' +
        '<div class="pa-info"><table>' + rows([
          ['Activity type', a.type], ['Training load', a.load],
          ['Universal objective', (function () {
            var x = ((window.CLUB && window.CLUB.gameSizes) || []).filter(function (y) { return y.key === a.numbers; })[0];
            return x ? a.numbers + ' \u2014 ' + x.objective : '';
          })()],
          ['Objective', a.objective],
          ['Set-up', a.description],
          ['Area', [a.areaSize, a.area, a.channel, a.numbers].filter(Boolean).join(' \u00b7 ')],
          ['Scoring', a.scoringMethods],
          ['Constraints', a.constraints],
          ['Key coaching points', a.coachingPoints],
          ['Interactions', [(a.when || []).join(' \u00b7 '), (a.how || []).join(' \u00b7 '),
            (a.other || []).join(' \u00b7 ')].filter(Boolean).join('  |  ')],
          ['Timing', ['intro ' + (a.intro || 0), (a.intervals || 0) + ' intervals',
            'time ' + (a.time || 0), 'rest ' + (a.rest || 0), 'transition ' + (a.transition || 0)].join(' \u00b7 ')]
        ]) + '</table></div>' +
        (hasDia ? '<div class="pa-fig">' + img + '</div>' : '') +
        '</div></section>';
    });

    /* a diagram no activity could claim still prints, together at the end.
       normalizeBoards has already handed every adoptable one to an activity,
       so anything here really does belong to nothing. */
    var unused = orphanBoards().filter(function (k) { return hasContent(session.boardStates[k]); });
    if (unused.length) {
      html += '<section class="pa"><h2>Other diagrams<span class="pa-t">' + unused.length +
        '</span></h2><div class="pa-extra">' +
        unused.map(function (k) {
          return '<img class="pa-dia" src="' + window.renderBoardPNG(session.boardStates[k], 1) + '">';
        }).join('') + '</div></section>';
    }
    document.getElementById('printOnly').innerHTML = html;
    document.body.classList.add('has-printsheet');
    document.body.classList.remove('onepage');
    pageStyle(false);
  }

  function fillSquadSelect() {
    var sq = document.getElementById('f_squad');
    if (!sq) return;
    sq.innerHTML = '';
    S.planList().forEach(function (p) { sq.appendChild(el('option', { value: p.id, text: p.short })); });
    sq.appendChild(el('option', { value: '__new', text: '+ New team...' }));
    sq.value = session.squad;
    sq.onchange = function () {
      if (sq.value === '__new') { newTeam(); return; }
      session.squad = sq.value;
      S.setPref('squad', sq.value);
      ctx(); renderReadiness(); mark();
    };
  }

  /* A team is a plan. Created here so a new squad does not mean leaving the session. */
  function newTeam() {
    var sq = document.getElementById('f_squad');
    sq.value = session.squad;
    var back = el('div', { class: 'modal' , onclick: function (e) { if (e.target === back) back.remove(); } });
    var panel = el('div', { class: 'card', style: 'max-width:560px;width:100%' });
    panel.appendChild(el('div', { class: 'card-hd' }, [el('h2', { text: 'New team' })]));
    var bd = el('div', { class: 'card-bd' });
    bd.appendChild(el('p', { class: 'hint', style: 'margin:0 0 14px',
      text: 'This creates a plan: a calendar you can sequence and write sessions against. Fixtures and blocks can be added later on the Plans page.' }));

    var name = el('input', { type: 'text', placeholder: 'U15 Girls' });
    var sd = el('input', { type: 'date', value: S.todayISO() });
    var ed = el('input', { type: 'date' });
    var end = new Date(); end.setMonth(end.getMonth() + 4);
    ed.value = end.toISOString().slice(0, 10);
    var g = el('div', { class: 'grid g2' }, [
      el('label', { class: 'f span-all' }, [el('span', { text: 'Team name' }), name]),
      el('label', { class: 'f' }, [el('span', { text: 'Season starts' }), sd]),
      el('label', { class: 'f' }, [el('span', { text: 'Season ends' }), ed])
    ]);
    bd.appendChild(g);

    bd.appendChild(el('p', { class: 'eyebrow', style: 'margin:16px 0 8px', text: 'Training days and length' }));
    var days = el('div', { class: 'grid g4' });
    var training = { '1': 75, '2': 90, '4': 75 };
    [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']]
      .forEach(function (d) {
        var i = el('input', { type: 'number', class: 'num', min: '0', max: '240', step: '5', placeholder: 'rest' });
        i.value = training[d[0]] || '';
        i.addEventListener('input', function () {
          var v = parseInt(i.value, 10);
          if (v > 0) training[d[0]] = v; else delete training[d[0]];
        });
        days.appendChild(el('label', { class: 'f' }, [el('span', { text: d[1] }), i]));
      });
    bd.appendChild(days);

    bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:18px' }, [
      el('button', { class: 'btn turf', text: 'Create team', onclick: function () {
        if (!name.value.trim()) { S.toast('Give the team a name.'); return; }
        if (!sd.value || !ed.value || ed.value < sd.value) { S.toast('Check the dates.'); return; }
        if (!Object.keys(training).length) { S.toast('Set at least one training day.'); return; }
        var cfg = S.savePlanConfig({
          id: null, label: name.value.trim(), short: name.value.trim(),
          start: sd.value, end: ed.value, training: training,
          gameDuration: '2x40', blocks: [], fixtures: []
        });
        if (!cfg) return;
        session.squad = cfg.id;
        S.setPref('squad', cfg.id);
        fillSquadSelect(); ctx(); renderReadiness(); mark();
        back.remove();
        S.toast('Team created. Add fixtures and blocks on the Plans page when you have them.');
      } }),
      el('button', { class: 'btn ghost', text: 'Cancel', onclick: function () { back.remove(); } }),
      el('a', { class: 'btn ghost', href: 'plans.html', text: 'Full plan builder' })
    ]));
    panel.appendChild(bd); back.appendChild(panel);
    document.body.appendChild(back);
    name.focus();
  }

  function printNow() {
    var mode = (document.getElementById('printMode') || {}).value || 'one';
    var build = function () { if (mode === 'one') buildOnePage(); else buildPrint(); };
    build();
    /* a picture still decoding would have printed as an empty board, so the
       sheet is built again the moment it is ready */
    var cold = allBoardStates().filter(function (st) {
      return st && st.frame && !window.boardFrameSeen(st.frame);
    });
    if (cold.length) window.preloadBoardFrames(cold, build);
  }

  /* ---------------- init ---------------- */
  function init() {
    fillSquadSelect();

    board = new window.Board(document.getElementById('board'));
    board.onchange = function () { buildRail(); };
    buildRail();
    bind();

    document.getElementById('boardCancel').addEventListener('click', function () { closeBoard(false); });
    document.getElementById('boardInsert').addEventListener('click', function () { closeBoard(true); });
    document.getElementById('boardModal').addEventListener('click', function (e) {
      if (e.target.id === 'boardModal') closeBoard(true);
    });

    document.getElementById('addMethod').addEventListener('click', function () {
      var v = prompt('New session method');
      if (!v) return;
      window.Lists.add('methods', v.trim());
      session.method = v.trim();
      fillClubSelects();
      document.getElementById('f_method').value = session.method;
      mark();
      S.toast('Added to the method list for every session from now on.');
    });
    var bl = document.getElementById('btnInstLib');
    if (bl) bl.addEventListener('click', openInstanceLibrary);
    var bs = document.getElementById('btnInstSave');
    if (bs) bs.addEventListener('click', saveInstance);
    document.getElementById('btnAddComp').addEventListener('click', function () {
      session.components = session.components || [];
      session.components.push({ text: '', filter: '', missing: '' });
      renderComponents(); renderInstanceCheck(); mark();
    });
    var inm = document.getElementById('f_instanceName');
    if (inm) inm.addEventListener('input', function () { renderInstanceCheck(); });
    document.getElementById('btnAddKey').addEventListener('click', function () {
      session.keyPlayers = session.keyPlayers || [];
      session.keyPlayers.push({ num: '', pos: '', playerId: '', name: '', why: '' });
      renderKeyPlayers(); mark();
    });
    document.getElementById('btnSave').addEventListener('click', function () { save(); });
    document.getElementById('btnSubmit').addEventListener('click', submit);
    document.getElementById('btnOpen').addEventListener('click', openPicker);
    document.getElementById('btnNew').addEventListener('click', function () {
      if (dirty) save(true);
      session = blank();
      S.setPref('lastSession', '');
      toForm(); clean('New session');
      renderStatus();
    });
    document.getElementById('btnExport').addEventListener('click', exportJSON);
    document.getElementById('btnPublish').addEventListener('click', function () {
      var mine = Object.keys(S.allSessions()).length;
      if (!mine && !S.libraryCount()) { S.toast('Save a session first.'); return; }
      if (!confirm('Build data.sessions.js from the ' + mine + ' session(s) in this browser?\n\n' +
        'Drop the file into js/ and redeploy. Every device then sees them, read-only.')) return;
      S.download('data.sessions.js', S.libraryFile(), 'application/javascript');
    });
    document.getElementById('btnImport').addEventListener('click', function () {
      S.pickFile('.json,application/json', importJSON);
    });
    document.getElementById('btnPrint').addEventListener('click', function () { printNow(); window.print(); });
    document.getElementById('btnTally').addEventListener('click', function () {
      if (dirty) save(true);
      this.href = 'kpi.html?id=' + encodeURIComponent(session.id);
    });
    document.getElementById('btnReview').addEventListener('click', function () {
      if (dirty) save(true);
      this.href = 'review.html?id=' + encodeURIComponent(session.id);
    });
    window.addEventListener('beforeprint', printNow);

    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'Escape' && !document.getElementById('boardModal').hidden) { closeBoard(true); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); board.deleteSel(); buildRail(); }
      /* only while the diagram is open, so the browser keeps its own Ctrl+D everywhere else */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !document.getElementById('boardModal').hidden) {
        e.preventDefault(); board.duplicateSel(); buildRail();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? board.redo() : board.undo(); }
      if (e.key === 'r' || e.key === 'R') board.rotateSel();
    });
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });
    if (window.Autosave) window.Autosave.register({
      save: function () { save(true); },
      isDirty: function () { return dirty; }
    });

    var q = new URLSearchParams(location.search);
    if (q.get('id')) { load(q.get('id')); return; }
    /* Coming back from the tally sheet or the review should land you on the
       session you were writing, not on a blank one. */
    if (!q.get('date') && !q.get('principle') && !q.get('focus')) {
      var last = S.prefs().lastSession;
      if (last && S.getSession(last)) { load(last); return; }
    }
    if (q.get('date')) session.date = q.get('date');
    if (q.get('squad')) session.squad = q.get('squad');
    if (q.get('principle')) {
      session.principleCode = q.get('principle');
      var qp = S.principle(session.principleCode);
      if (qp) session.moment = qp.moment;
    }
    if (q.get('focus')) session.focus = q.get('focus');
    if (q.get('pa')) session.pa = q.get('pa').split('|').concat(['', '', '', '']).slice(0, 4);
    toForm();
    clean('Not saved yet');
    renderStatus();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

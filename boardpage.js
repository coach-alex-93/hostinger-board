/* ============================================================
   boardpage.js — standalone tactics board
   The same engine the planner uses, on its own page, with a clip
   reference and a verdict so a board made while watching video is
   a record of a moment rather than a loose drawing.
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el;
  var KEY = 'ncfc.boards.v1';
  var MOMENTS = ['Attacking Organization', 'Defensive Organization', 'Attacking Transition', 'Defensive Transition'];
  var PHASES = {
    'Attacking Organization': ['Building', 'Attacking', 'Finishing'],
    'Defensive Organization': ['Impeding', 'Recovering', 'Protecting'],
    'Attacking Transition': ['Gaining Possession - Counter Attack', 'Gaining Possession - Secure Reorganize'],
    'Defensive Transition': ['Losing Possession - Counter-Press', 'Losing Possession - Reorganize']
  };
  var FIELDS = ['title', 'date', 'squad', 'video', 'stamp', 'context', 'moment', 'phase', 'principle',
    'note', 'verdict', 'passage', 'pFrom', 'pTo', 'expect'];
  var board, current = null, dirty = false, clip = null;

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { S.toast('Storage is full. Delete an old board or export one.'); return false; }
  }
  function all() {
    var d = read();
    return Object.keys(d).map(function (k) { return d[k]; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }
  function blank() {
    return {
      id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: '', date: S.todayISO(), squad: S.defaultPlanId(), video: '', stamp: '', context: '',
      moment: '', phase: '', principle: '', note: '', verdict: '',
      frame: '', clipName: '', fixture: '',
      expect: { target: '', seen: 0, met: 0, why: '' }, expectType: '', expectTeam: '',
      passage: '', pFrom: '', pTo: '', expect: '', expects: [],
      state: { field: 'full', objects: [] }
    };
  }
  function mark() { dirty = true; document.getElementById('saveState').textContent = 'Unsaved board'; }
  function clean(t) { dirty = false; document.getElementById('saveState').textContent = t || 'Board saved'; }

  function fillSelects() {
    var sq = document.getElementById('f_squad');
    if (!sq) return;
    sq.innerHTML = '';
    S.planList().forEach(function (p) { sq.appendChild(el('option', { value: p.id, text: p.short })); });
    sq.value = current.squad;

    function opts(id, list, val, blankTxt) {
      var s = document.getElementById(id);
      if (!s) return;
      s.innerHTML = '';
      s.appendChild(el('option', { value: '', text: blankTxt }));
      list.forEach(function (x) {
        var v = typeof x === 'object' ? x.v : x, t = typeof x === 'object' ? x.t : x;
        s.appendChild(el('option', { value: v, text: t }));
      });
      s.value = val || '';
    }
    opts('f_moment', MOMENTS, current.moment, '- moment -');
    var known = Object.keys(PHASES).reduce(function (a, m) { return a.concat(PHASES[m]); }, []);
    var extra = (window.Lists ? window.Lists.get('phases') : []).filter(function (x) { return known.indexOf(x) < 0; });
    var phaseList = current.moment
      ? PHASES[current.moment].concat(extra)
      : known.map(function (x) {
          var m2 = Object.keys(PHASES).filter(function (k) { return PHASES[k].indexOf(x) >= 0; })[0] || '';
          return { v: x, t: m2.split(' ')[0] + ' \u00b7 ' + x };
        }).concat(extra.map(function (x) { return { v: x, t: 'Yours \u00b7 ' + x }; }));
    opts('f_phase', phaseList, current.phase, '- any phase -');
    opts('f_principle', (window.PRINCIPLES || [])
      .filter(function (p) { return !current.moment || p.moment === current.moment; })
      .map(function (p) { return { v: p.code, t: '[' + p.clubCode + '] ' + (p.clubName || p.name) }; }),
      current.principle, '- principle -');
  }

  function fillList() {
    var sel = document.getElementById('boardSel');
    sel.innerHTML = '';
    var list = all();
    if (!list.length) { sel.appendChild(el('option', { value: '', text: 'No boards yet' })); return; }
    list.forEach(function (b) {
      sel.appendChild(el('option', { value: b.id,
        text: S.fmt(b.date) + ' \u00b7 ' + (b.title || 'untitled') + (b.stamp ? ' \u00b7 ' + b.stamp : '') }));
    });
    sel.value = current.id;
  }

  function toForm() {
    FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (n && ['squad', 'moment', 'phase', 'principle', 'expect', 'expectType'].indexOf(k) < 0) {
        n.value = current[k] || '';
      }
    });
    var etn = document.getElementById('f_expectType');
    if (etn) etn.value = current.expectType || '';
    fillSelects();
    board.setState(current.state || { field: 'full', objects: [] });
    board.setFrame(current.frame || '');
    setMode(board.state.field === 'clip');
    document.getElementById('bTitle').textContent = current.title || 'Board';
    if (window.buildBoardRail) window.buildBoardRail(board, 'rail');
    renderActions();
    renderExpect();
    fillList();
  }

  function save() {
    current.state = board.getState();
    if (current.state.field !== 'clip') current.frame = current.frame || '';
    var d = read();
    d[current.id] = current;
    if (!write(d)) return;
    clean(); fillList();
  }
  function load(id) {
    var d = read();
    current = d[id] ? JSON.parse(JSON.stringify(d[id])) : blank();
    toForm(); clean(d[id] ? 'Opened' : 'New board');
  }

  /* ---------- actions ----------
     Every two-point mark on the board is a candidate action. Classify it and
     the line recolours, the totals update, and it can be counted as a KPI. */
  function actionDefs() { return (window.CLUB && window.CLUB.actions) || []; }
  function defOf(type) { return actionDefs().filter(function (a) { return a.type === type; })[0] || null; }
  function isLine(o) { return ['pass', 'arrow', 'dribble', 'line', 'dash', 'curve', 'curvepass'].indexOf(o.type) >= 0; }
  function drawn() { return (board ? board.state.objects : []).filter(isLine); }

  function roster() {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    return Object.keys(d.players || {}).map(function (k) { return d.players[k]; })
      .filter(function (p) { return p.plan === current.squad; })
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }

  function classify(o) {
    o.act = o.act || { type: '', outcome: '', player: '', ok: false };
    if (o.act.type && o.act.outcome) {
      var def = defOf(o.act.type);
      o.act.ok = !!(def && def.success.indexOf(o.act.outcome) >= 0);
    } else { o.act.ok = false; }
    var fld = (board && board.state && board.state.field) || 'full';
    var zf = window.Board.zoneOf(o.x, o.y, fld);
    var zt = window.Board.zoneOf(o.x2, o.y2, fld);
    o.act.zoneFrom = zf.key;
    o.act.zone = zt.key;
    /* an action that changes third is an entry, and that is usually the
       interesting thing about it */
    o.act.area = zt.area || '';
    o.act.entry = zt.area && zt.area !== zf.area
      ? (zf.third + ' \u2192 ' + (zt.end === 'defensive' ? 'own ' + zt.area.toLowerCase() : zt.area))
      : (zf.third === zt.third ? '' : (zf.third + ' \u2192 ' + zt.third));
    o.act.lane = zf.channel === zt.channel ? zt.channel : (zf.channel + ' \u2192 ' + zt.channel);
    return o.act;
  }

  function renderActions() {
    var list = document.getElementById('actList');
    var sum = document.getElementById('actSum');
    if (!list || !sum) return;
    list.innerHTML = ''; sum.innerHTML = '';
    var marks = drawn();
    if (!marks.length) {
      sum.appendChild(el('div', { class: 'empty',
        text: 'Draw a pass, run, dribble or line on the board and it appears here to classify.' }));
      return;
    }

    // totals
    var n = 0, ok = 0, byType = {}, byPlayer = {}, byZone = {};
    marks.forEach(function (o) {
      var a = classify(o);
      if (!a.type || !a.outcome) return;
      n++; if (a.ok) ok++;
      function bump(m, k) { if (!k) return; m[k] = m[k] || { n: 0, ok: 0 }; m[k].n++; if (a.ok) m[k].ok++; }
      bump(byType, a.type); bump(byPlayer, a.player);
      bump(byZone, a.entry || ('Within ' + a.zone));
    });
    var st = el('div', { class: 'stats' });
    [[marks.length, 'Marks drawn'], [n, 'Classified'], [ok, 'Successful'],
     [n ? Math.round(ok / n * 100) + '%' : '-', 'Success rate']].forEach(function (x) {
      st.appendChild(el('div', { class: 'stat' }, [el('b', { text: String(x[0]) }), el('span', { text: x[1] })]));
    });
    sum.appendChild(st);

    function bars(title, map) {
      var keys = Object.keys(map);
      if (!keys.length) return;
      keys.sort(function (a, b) { return map[b].n - map[a].n; });
      var box = el('div', { style: 'margin-top:14px' });
      box.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px', text: title }));
      var rows = el('div', { class: 'plrows' });
      keys.forEach(function (k) {
        var pct = Math.round(map[k].ok / map[k].n * 100);
        rows.appendChild(el('div', { class: 'plrow' }, [
          el('span', { class: 'pn', text: k }),
          el('span', { class: 'bar' }, [el('i', { style: 'width:' + pct + '%' })]),
          el('span', { class: 'pv', text: map[k].ok + '/' + map[k].n + '  ' + pct + '%' })
        ]));
      });
      box.appendChild(rows);
      sum.appendChild(box);
    }
    bars('By action', byType);
    bars('By player', byPlayer);
    bars('By zone and entry', byZone);

    if (n) {
      sum.appendChild(el('div', { class: 'btnrow', style: 'margin-top:12px' }, [
        el('button', { class: 'btn ghost sm', text: 'Send a type to KPIs', onclick: sendToKPI })
      ]));
    }

    // the rows
    var people = roster();
    marks.forEach(function (o, i) {
      var a = classify(o);
      var def = defOf(a.type);
      var row = el('div', { class: 'actrow' + (a.outcome ? (a.ok ? ' ok' : ' bad') : '') });

      function pick(items, val, cb, blank) {
        var s2 = el('select');
        s2.appendChild(el('option', { value: '', text: blank }));
        (items || []).forEach(function (x) {
          var v = typeof x === 'object' ? x.v : x, t = typeof x === 'object' ? x.t : x;
          s2.appendChild(el('option', { value: v, text: t }));
        });
        s2.value = val || '';
        s2.addEventListener('change', function () { cb(s2.value); mark(); board.draw(); renderActions(); });
        return s2;
      }

      row.appendChild(el('div', { class: 'actgrid' }, [
        el('label', { class: 'f' }, [el('span', { text: 'Mark' }),
          el('div', { class: 'hint', style: 'padding-top:6px;font-family:var(--mono)',
            text: (i + 1) + ' \u00b7 ' + o.type })]),
        el('label', { class: 'f' }, [el('span', { text: 'Action' }),
          pick(actionDefs().map(function (x) { return x.type; }), a.type,
            function (v) { a.type = v; a.outcome = ''; }, 'Action?')]),
        el('label', { class: 'f' }, [el('span', { text: 'Outcome' }),
          pick(def ? def.outcomes : [], a.outcome, function (v) { a.outcome = v; },
            def ? 'Outcome?' : 'pick an action first')]),
        el('label', { class: 'f' }, [el('span', { text: 'Player' }),
          pick(people.map(function (p) { return { v: p.name, t: (p.number ? p.number + ' ' : '') + p.name }; })
            .concat([{ v: 'Opponent', t: 'Opponent' }]), a.player, function (v) { a.player = v; }, 'Who?')]),
        el('label', { class: 'f' }, [el('span', { text: 'Principle' }),
          pick((window.PRINCIPLES || []).map(function (p) {
            return { v: p.code, t: '[' + p.clubCode + '] ' + (p.clubName || p.name) };
          }), a.principle, function (v) { a.principle = v; }, 'Principle?')]),
        el('label', { class: 'f' }, [el('span', { text: 'Zone' }),
          el('div', { style: 'padding-top:4px' }, [
            el('div', { class: 'hint', style: 'font-size:11.5px', text: (a.zoneFrom || '') + ' \u2192 ' + (a.zone || '') }),
            a.area
              ? el('span', { class: 'chip ao', style: 'margin-top:3px',
                  text: (a.entry || a.area) }) 
              : (a.entry
                ? el('span', { class: 'chip at', style: 'margin-top:3px', text: a.entry })
                : el('span', { class: 'chip off', style: 'margin-top:3px', text: 'same third' }))
          ])])
      ]));
      list.appendChild(row);
    });
  }

  function sendToKPI() {
    if (!window.KPI) { S.toast('KPI module not loaded.'); return; }
    var types = {};
    drawn().forEach(function (o) { if (o.act && o.act.type && o.act.outcome) types[o.act.type] = (types[o.act.type] || 0) + 1; });
    var keys = Object.keys(types);
    if (!keys.length) return;
    var which = prompt('Which action should become a KPI?\n\n' + keys.join('\n'), keys[0]);
    if (!which || !types[which]) return;
    var def = defOf(which);
    window.KPI.save({
      id: null, category: which + ' success rate',
      description: 'Counted from the tactics board. Success: ' + (def ? def.success.join(', ') : '') + '.',
      principle: '', unit: 'rate'
    });
    S.toast('KPI created. Set its target on a session.');
  }

  function actionsCSV() {
    var rows = [['Board', 'Date', 'Squad', 'Clip', 'Timestamp', 'Mark', 'Action', 'Outcome',
      'Successful', 'Player', 'Principle', 'Zone from', 'Zone to', 'Area', 'Third entry', 'Lane', 'Verdict']];
    var exp = [['Board', 'Date', 'Passage', 'From', 'To', 'Expected to see', 'Counting', 'Target', 'Actual', 'Met']];
    all().forEach(function (b) {
      (b.expects || []).forEach(function (e) {
        if (!e.type) return;
        exp.push([b.title || '', b.date || '', b.passage || '', b.pFrom || '', b.pTo || '',
          b.expect || '', e.type, e.target === '' ? '' : e.target, e.n || 0,
          e.target === '' || e.target == null ? '' : ((e.n || 0) >= +e.target ? 'Yes' : 'No')]);
      });
    });
    if (exp.length > 1) setTimeout(function () { S.exportAs('Passage_expectations', exp); }, 400);
    all().forEach(function (b) {
      (b.state && b.state.objects || []).filter(isLine).forEach(function (o, i) {
        if (!o.act || !o.act.type) return;
        rows.push([b.title || '', b.date || '', S.planLabel(b.squad), b.video || '', b.stamp || '',
          i + 1, o.act.type, o.act.outcome || '', o.act.ok ? 'Yes' : 'No', o.act.player || '',
          o.act.principle || '', o.act.zoneFrom || '', o.act.zone || '', o.act.area || '', o.act.entry || '',
          o.act.lane || '', b.verdict || '']);
      });
    });
    if (rows.length === 1) { S.toast('No classified actions yet.'); return; }
    S.exportAs('Board_actions', rows);
  }

  /* ---------- clip mode ---------- */
  function setMode(on) {
    var pane = document.getElementById('clipPane');
    if (!pane) return;
    pane.hidden = !on;
    var pm = document.getElementById('btnPitchMode');
    var cm = document.getElementById('btnClipMode');
    if (pm) pm.style.display = on ? '' : 'none';
    if (cm) cm.style.display = on ? 'none' : '';
    if (on && !clip) {
      clip = window.Clip.mount(pane, {
        onName: function (n) {
          current.clipName = n;
          var v = document.getElementById('f_video');
          if (!current.video) { current.video = n; if (v) v.value = n; }
          mark();
        },
        onFreeze: function (data, t, n) {
          current.frame = data;
          current.clipName = n || current.clipName;
          current.stamp = window.Clip.mmss(t);
          var st2 = document.getElementById('f_stamp');
          if (st2) st2.value = current.stamp;
          if (!current.pFrom) {
            current.pFrom = current.stamp;
            var pf = document.getElementById('f_pFrom');
            if (pf) pf.value = current.pFrom;
          }
          board.state.field = 'clip';
          board.setFrame(data);
          mark();
          S.toast('Frame frozen at ' + current.stamp + '. Draw on it with the tools on the right.');
        }
      });
    }
  }

  /* ---------- put a real team on the board ----------
     Pulls the eleven and the substitutes from a game's team sheet, so a board
     drawn for Saturday has Saturday's names on it. */
  function pickXI() {
    var L = window.Lineup;
    var plan = current.squad || S.defaultPlanId();
    var games = S.days(plan).filter(function (r) {
      return r.event.indexOf('Game') === 0 && !/Cancelled/.test(r.event);
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });

    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var card = el('div', { class: 'card', style: 'max-width:520px;width:100%' });
    card.appendChild(el('div', { class: 'card-hd' }, [el('h2', { text: 'Put a team on the board' })]));
    var bd = el('div', { class: 'card-bd' });

    if (!games.length) {
      bd.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'No games on this plan.' }));
    } else {
      var sel = el('select');
      games.forEach(function (g) {
        var l = L.get(plan, g.date);
        var n = (l.starters || []).filter(function (x) { return x.playerId; }).length;
        sel.appendChild(el('option', { value: g.date,
          text: S.fmt(g.date) + (g.opp ? ' v ' + g.opp : '') + (n ? ' \u00b7 ' + n + ' named' : ' \u00b7 no sheet') }));
      });
      bd.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Which game' }), sel]));

      var withSubs = el('input', { type: 'checkbox' });
      var lay = el('input', { type: 'checkbox' });
      lay.checked = true;
      bd.appendChild(el('div', { class: 'subs', style: 'margin-top:10px;max-height:none' }, [
        el('label', {}, [withSubs, el('span', { text: 'Include the substitutes, off the pitch' })]),
        el('label', {}, [lay, el('span', { text: 'Lay them out in the formation, if one is set' })])
      ]));

      bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:14px' }, [
        el('button', { class: 'btn turf', text: 'Place them', onclick: function () {
          placeXI(plan, sel.value, withSubs.checked, lay.checked);
          back.remove();
        } }),
        el('button', { class: 'btn ghost', text: 'Cancel', onclick: function () { back.remove(); } })
      ]));
    }
    card.appendChild(bd); back.appendChild(card);
    document.body.appendChild(back);
  }

  function placeXI(plan, date, withSubs, layout) {
    var L = window.Lineup;
    var l = L.get(plan, date);
    var people = L.roster(plan);
    var name = function (id) {
      var p = people.filter(function (x) { return x.id === id; })[0];
      return p || null;
    };
    var starters = (l.starters || []).filter(function (x) { return x.playerId; });
    if (!starters.length) { S.toast('That game has no team sheet yet.'); return; }

    var st = board.getState();
    var objs = st.objects.filter(function (o) { return !o.fromXI; });

    var shape = [];
    if (layout && l.formation) {
      var f = null;
      try {
        f = ((JSON.parse(localStorage.getItem('ncfc.gamemodel.v1') || '{}').formations) || [])
          .filter(function (x) { return x.name === l.formation; })[0];
      } catch (e) {}
      var sh = f && (f.shapeIn || f.shapeOut) || '';
      shape = sh.replace(/[^0-9-]/g, '').split('-').map(Number).filter(function (n) { return n > 0; });
    }

    var W = 620, H = 600, idx = 0;
    function put(rec, x, y) {
      var p = name(rec.playerId);
      objs.push({ type: 'tri', color: 'blue', x: Math.round(x), y: Math.round(y), dir: 0,
        n: rec.num || (p && p.number) || '', fromXI: true });
      if (p) objs.push({ type: 'text', color: 'white', x: Math.round(x), y: Math.round(y) + 24,
        t: p.name.split(' ')[0], fromXI: true });
    }
    if (shape.length) {
      put(starters[idx++], W / 2, H - 60);
      var rows = shape.length + 1;
      shape.forEach(function (n, li) {
        var y = H - 60 - (li + 1) * ((H - 170) / rows);
        for (var k = 0; k < n && idx < starters.length; k++) {
          put(starters[idx++], W * (k + 1) / (n + 1), y);
        }
      });
    }
    while (idx < starters.length) {
      put(starters[idx], 70 + (idx % 5) * 120, 120 + Math.floor(idx / 5) * 70);
      idx++;
    }
    if (withSubs) {
      (l.subs || []).filter(function (x) { return x.playerId; }).forEach(function (rec, i) {
        var p = name(rec.playerId);
        objs.push({ type: 'cir', color: 'white', x: 40, y: 60 + i * 34, dir: 0,
          n: rec.num || (p && p.number) || '', fromXI: true });
        if (p) objs.push({ type: 'text', color: 'white', x: 92, y: 60 + i * 34,
          t: p.name.split(' ')[0], fromXI: true });
      });
    }
    st.objects = objs;
    board.setState(st);
    mark();
    S.toast(starters.length + ' named' + (withSubs ? ' plus substitutes' : '') +
      '. Drag anyone who is not where you want them.');
  }

  /* ---------- an expectation, set before watching ----------
     A clip is worth more when you commit to what should happen in it first.
     Count against that rather than deciding afterwards what you saw. */
  function renderExpect() {
    var host = document.getElementById('expectPad');
    if (!host) return;
    var sel = document.getElementById('f_expectType');
    if (sel && !sel.options.length) {
      sel.appendChild(el('option', { value: '', text: '- what to count -' }));
      ((window.CLUB && window.CLUB.actions) || []).forEach(function (a) {
        sel.appendChild(el('option', { value: a.type, text: a.type }));
      });
      sel.value = current.expectType || '';
    }
    host.innerHTML = '';
    current.expect = current.expect || { target: '', seen: 0, met: 0 };
    var e = current.expect;

    var tgt = el('input', { type: 'number', class: 'num', min: '0', placeholder: 'e.g. 3' });
    tgt.value = e.target === 0 ? '0' : (e.target || '');
    tgt.addEventListener('input', function () { e.target = tgt.value === '' ? '' : +tgt.value; mark(); renderExpect(); });

    var target = parseFloat(e.target);
    var hit = isFinite(target) ? e.met >= target : null;

    var pad = el('div', { class: 'scoutpad' });
    pad.appendChild(el('div', { class: 'tally-hd' }, [
      el('b', { text: current.expectType || 'Counting' }),
      el('span', { class: 'chip ' + (hit === null ? 'off' : (hit ? 'ao' : 'dt')),
        text: hit === null ? 'no expectation set'
          : (hit ? 'expectation met' : 'short of the expectation') })
    ]));
    pad.appendChild(el('div', { class: 'tally-now',
      text: e.met + ' of ' + e.seen + ' seen' +
        (isFinite(target) ? ', expected ' + target : '') +
        (e.seen ? '  \u00b7  ' + Math.round(e.met / e.seen * 100) + '%' : '') }));

    var rows = el('div', { class: 'tally-rows' });
    [['seen', 'Happened at all'], ['met', 'Did what I expected']].forEach(function (f) {
      rows.appendChild(el('div', { class: 'tally-row' }, [
        el('button', { class: 'tbtn minus', type: 'button', text: '\u2212',
          onclick: function () { e[f[0]] = Math.max(0, (e[f[0]] || 0) - 1); mark(); renderExpect(); } }),
        el('div', { class: 'tlab' }, [el('span', { text: f[1] }), el('b', { text: String(e[f[0]] || 0) })]),
        el('button', { class: 'tbtn plus', type: 'button', text: '+',
          onclick: function () {
            e[f[0]] = (e[f[0]] || 0) + 1;
            if (f[0] === 'met' && e.met > e.seen) e.seen = e.met;
            mark(); renderExpect();
          } })
      ]));
    });
    pad.appendChild(rows);
    host.appendChild(pad);

    var g = el('div', { class: 'grid g3', style: 'margin-top:10px;align-items:end' });
    g.appendChild(el('label', { class: 'f' }, [el('span', { text: 'How many I expected' }), tgt]));
    var why = el('input', { type: 'text', placeholder: 'why it did or did not happen' });
    why.value = e.why || '';
    why.addEventListener('input', function () { e.why = why.value; mark(); });
    g.appendChild(el('label', { class: 'f span2' }, [el('span', { text: 'What actually decided it' }), why]));
    host.appendChild(g);
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:8px',
      text: 'Set the expectation before you play the clip. Counting what happened and then calling it ' +
        'the expectation is how a clip confirms whatever you already believed.' }));
  }

  /* ---------- team sheet ---------- */
  var sheet = null;
  function roster2() {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    return Object.keys(d.players || {}).map(function (k) { return d.players[k]; })
      .filter(function (p) { return p.plan === current.squad; })
      .sort(function (a, b) { return (+a.number || 99) - (+b.number || 99) || (a.name || '').localeCompare(b.name || ''); });
  }
  function shapes() {
    var out = [];
    try {
      var gm = JSON.parse(localStorage.getItem('ncfc.gamemodel.v1') || '{}');
      (gm.formations || []).forEach(function (f) {
        if (f.shapeIn) out.push(f.shapeIn);
        if (f.shapeOut && f.shapeOut !== f.shapeIn) out.push(f.shapeOut);
      });
    } catch (e) {}
    ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-4-3', '4-1-4-1'].forEach(function (x) {
      if (out.indexOf(x) < 0) out.push(x);
    });
    return out;
  }

  function fillFixtures() {
    var sel = document.getElementById('fixSel');
    var sh = document.getElementById('shapeSel');
    if (!sel || !sh) return;
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '', text: 'Not attached to a fixture' }));
    /* one line per game, so a double-header is two fixtures not one */
    window.Lineup.fixtures(current.squad).forEach(function (f) {
      var has = window.Lineup.get(current.squad, f.date, f.game);
      var ha = f.ha === 'A' ? 'at' : 'v';
      sel.appendChild(el('option', { value: f.date + '#' + f.game,
        text: (has ? '\u25cf ' : '\u25cb ') + S.dow(f.date) + ' ' + S.fmt(f.date) +
          (f.of > 1 ? '  game ' + (f.game + 1) + ' of ' + f.of : '') +
          (f.opp ? '  ' + ha + ' ' + f.opp : '') +
          (f.ko ? '  ' + f.ko : '') }));
    });
    sel.value = current.fixture || '';

    sh.innerHTML = '';
    sh.appendChild(el('option', { value: '', text: '- formation -' }));
    shapes().forEach(function (x) { sh.appendChild(el('option', { value: x, text: x })); });
    sh.value = sheet ? (sheet.formation || '') : '';
    var osh = document.getElementById('oppShapeSel');
    if (osh) {
      osh.innerHTML = '';
      osh.appendChild(el('option', { value: '', text: '- their shape -' }));
      shapes().forEach(function (x) { osh.appendChild(el('option', { value: x, text: 'v ' + x })); });
      osh.value = sheet ? (sheet.oppFormation || '') : '';
    }
    var on2 = document.getElementById('oppName');
    if (on2) on2.value = sheet ? (sheet.oppName || '') : '';
    var gl = document.getElementById('gameLen');
    if (gl) gl.value = sheet ? sheet.length : 80;
    var on3 = document.getElementById('oppName');
    if (on3 && sheet && !sheet.oppName) {
      /* the opposition is on the schedule; do not make anyone type it twice */
      var f3 = window.Lineup.fixtureAt(current.squad, sheet.date, sheet.game);
      if (f3 && f3.opp) { sheet.oppName = f3.opp; on3.value = f3.opp; }
    }
  }

  function loadSheet(ref) {
    current.fixture = ref || '';
    if (!ref) { sheet = null; fillFixtures(); renderSheet(); return; }
    var bits = String(ref).split('#');
    var date = bits[0], gi = +(bits[1] || 0);
    var fx = window.Lineup.fixtureAt(current.squad, date, gi);
    var len = 80;
    if (fx && fx.dur) {
      var m = /(\d+)\s*x\s*(\d+)/i.exec(fx.dur);
      if (m) len = (+m[1]) * (+m[2]);
    }
    sheet = window.Lineup.get(current.squad, date, gi) ||
      window.Lineup.blank(current.squad, date, len, gi);
    fillFixtures();
    renderSheet();
  }

  function renderSheet() {
    var host = document.getElementById('sheet');
    if (!host) return;
    host.innerHTML = '';
    if (!sheet) {
      host.appendChild(el('div', { class: 'empty',
        text: 'Pick a fixture above to build a team sheet against it.' }));
      return;
    }

    /* the fixture card, so the sheet is unmistakably about this game */
    var f = window.Lineup.fixtureAt(current.squad, sheet.date, sheet.game) || {};
    var box = el('div', { class: 'act', style: 'border-left-color:var(--flag-deep);margin-bottom:14px' });
    var ha = f.ha === 'H' ? 'Home' : (f.ha === 'A' ? 'Away' : (f.ha === 'N' ? 'Neutral' : ''));
    box.appendChild(el('div', { class: 'act-hd' }, [
      el('span', { class: 'lab', text: S.dow(sheet.date) + ' ' + S.fmt(sheet.date) }),
      f.of > 1 ? el('span', { class: 'chip flag', text: 'game ' + (sheet.game + 1) + ' of ' + f.of }) : null,
      f.opp ? el('span', { class: 'chip ' + (f.ha === 'A' ? 'dt' : 'ao'),
        text: (f.ha === 'A' ? 'at ' : 'v ') + f.opp }) : null,
      ha ? el('span', { class: 'chip', text: ha }) : null,
      f.ko ? el('span', { class: 'chip', text: f.ko }) : null,
      el('span', { class: 'sp' }),
      el('a', { class: 'btn ghost sm',
        href: 'periodization.html?plan=' + encodeURIComponent(current.squad),
        text: 'See it on the schedule' })
    ]));
    var bits2 = [f.venue, f.field, f.comp, f.dur].filter(Boolean).join('  \u00b7  ');
    if (bits2) box.appendChild(el('div', { class: 'act-bd' }, [el('p', { class: 'hint', style: 'margin:0', text: bits2 })]));
    if (f.of > 1) {
      box.appendChild(el('div', { class: 'act-bd' }, [el('p', { class: 'hint', style: 'margin:0',
        text: 'This date carries ' + f.of + ' games. Each has its own sheet, so a player who played both is two appearances and their minutes add up across the two.' })]));
    }
    host.appendChild(box);
    var people = roster2();
    if (!people.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'No roster on this plan. ' }),
        el('a', { href: 'idp.html', text: 'Add players' })
      ]));
      return;
    }
    var used = {};
    (sheet.xi || []).concat(sheet.subs || []).forEach(function (r) { if (r.playerId) used[r.playerId] = 1; });

    function rowsFor(list, label, isXI) {
      var box = el('div', { style: 'margin-bottom:14px' });
      box.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px',
        text: label + ' (' + list.length + ')' }));
      list.forEach(function (r, i) {
        var who = el('select');
        who.appendChild(el('option', { value: '', text: '- player -' }));
        people.forEach(function (pl) {
          if (used[pl.id] && pl.id !== r.playerId) return;
          who.appendChild(el('option', { value: pl.id,
            text: (pl.number ? pl.number + ' ' : '') + pl.name }));
        });
        who.value = r.playerId || '';
        who.addEventListener('change', function () { r.playerId = who.value; mark(); renderSheet(); });

        var pos = el('select');
        pos.appendChild(el('option', { value: '', text: '-' }));
        ((window.CLUB && window.CLUB.positions) || []).forEach(function (x) {
          pos.appendChild(el('option', { value: x.code, text: x.code }));
        });
        pos.value = r.pos || '';
        pos.addEventListener('change', function () { r.pos = pos.value; mark(); });

        function minBox(k, ph) {
          var n = el('input', { type: 'number', class: 'num', min: '0', max: String(sheet.length), placeholder: ph });
          n.value = r[k] === 0 ? '0' : (r[k] || '');
          n.addEventListener('input', function () { r[k] = n.value === '' ? '' : +n.value; mark(); renderSheet(); });
          return n;
        }
        var mins = window.Lineup.minutesIn(sheet, r.playerId);
        box.appendChild(el('div', { class: 'grid g5', style: 'margin-bottom:6px;align-items:end' }, [
          el('label', { class: 'f' }, [el('span', { text: (isXI ? 'XI ' : 'Sub ') + (i + 1) }), who]),
          el('label', { class: 'f' }, [el('span', { text: 'Pos' }), pos]),
          el('label', { class: 'f' }, [el('span', { text: 'On' }), minBox('on', isXI ? '0' : 'not used')]),
          el('label', { class: 'f' }, [el('span', { text: 'Off' }), minBox('off', 'full')]),
          el('div', { class: 'f' }, [
            el('span', { class: 'eyebrow', style: 'margin:0', text: 'Minutes' }),
            el('div', { style: 'font-family:var(--mono);font-size:15px;padding-top:6px',
              text: r.playerId ? String(mins) : '-' })
          ])
        ]));
      });
      box.appendChild(el('button', { class: 'btn ghost sm', text: '+ Add a ' + (isXI ? 'starter' : 'substitute'),
        onclick: function () { list.push({ playerId: '', pos: '', on: isXI ? 0 : '', off: '' }); mark(); renderSheet(); } }));
      if (list.length) {
        box.appendChild(el('button', { class: 'btn warn sm', style: 'margin-left:6px', text: 'Remove the last',
          onclick: function () { list.pop(); mark(); renderSheet(); } }));
      }
      return box;
    }
    host.appendChild(rowsFor(sheet.xi, 'Starting XI', true));
    host.appendChild(rowsFor(sheet.subs, 'Substitutes', false));

    var unpicked = people.filter(function (p) { return !used[p.id]; });
    if (unpicked.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0 0 10px',
        text: 'Not in the squad for this game: ' + unpicked.map(function (p) { return p.name; }).join(', ') }));
    }
    var tot = (sheet.xi || []).concat(sheet.subs || []).reduce(function (a, r) {
      return a + (r.playerId ? window.Lineup.minutesIn(sheet, r.playerId) : 0);
    }, 0);
    host.appendChild(el('p', { class: 'hint', style: 'margin:0',
      text: tot + ' player-minutes recorded. An eleven-a-side game of ' + sheet.length +
        ' minutes should come to ' + (sheet.length * 11) + '.' }));
  }

  /* Putting our XI out replaces our pieces, not the whole board, so the
     opposition and anything drawn stay put. */
  function placeXI() {
    if (!sheet || !sheet.formation) { S.toast('Pick our formation first.'); return; }
    var pts = window.Lineup.positions(sheet.formation, window.Board.W, window.Board.H, false);
    if (!pts.length) { S.toast('That formation could not be read.'); return; }
    var people = roster2();
    var objs = [];
    sheet.xi.slice(0, pts.length).forEach(function (r, i) {
      var pl = people.filter(function (p) { return p.id === r.playerId; })[0];
      var o = { type: i === 0 ? 'cir' : 'tri', color: 'blue', x: pts[i].x, y: pts[i].y, dir: 0, side: 'us' };
      if (pl && pl.number) o.n = String(pl.number);
      objs.push(o);
      if (pl) objs.push({ type: 'text', color: 'white', x: pts[i].x, y: pts[i].y + 24,
        t: pl.name.split(' ')[0], side: 'us' });
    });
    board.snap();
    var cleared = window.Lineup.clearSide(board, 'us');
    board.state.objects = board.state.objects.concat(objs);
    board.draw(); mark();
    S.toast(objs.filter(function (o) { return o.type !== 'text'; }).length +
      ' out in a ' + sheet.formation + (cleared ? ', replacing the previous XI' : '') + '.');
  }

  function placeOpp() {
    if (!sheet || !sheet.oppFormation) { S.toast('Pick their shape first.'); return; }
    var st = window.Lineup.diagram(sheet.oppFormation, null, { flip: true, color: 'red', side: 'them' });
    if (!st) { S.toast('That shape could not be read.'); return; }
    board.snap();
    var cleared = window.Lineup.clearSide(board, 'them');
    board.state.objects = board.state.objects.concat(st.objects);
    if (sheet.oppName) {
      board.state.objects.push({ type: 'text', color: 'white', x: window.Board.W / 2, y: 34,
        t: sheet.oppName + '  ' + sheet.oppFormation, side: 'them' });
    }
    board.draw(); mark();
    S.toast((sheet.oppName || 'The opposition') + ' out in a ' + sheet.oppFormation +
      (cleared ? ', replacing their previous shape' : '') + '.');
  }

  function clearPitch() {
    var n = board.state.objects.length;
    if (!n) { S.toast('Nothing on the pitch.'); return; }
    if (!confirm('Clear all ' + n + ' pieces?\n\nUndo will bring them back.')) return;
    board.snap();
    board.state.objects = [];
    board.sel = -1;
    board.draw(); mark();
  }

  /* ---------- expectation for a passage ----------
     The counting on the Scouting page is for a whole game. This is the other
     unit: a short passage where you say in advance what should happen, then
     count whether it did. Written before watching, judged after. */
  function expList() {
    current.expects = current.expects || [];
    return current.expects;
  }
  function renderExpects() {
    var host = document.getElementById('expects');
    if (!host) return;
    host.innerHTML = '';
    var list = expList();
    if (!list.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'Nothing to count yet. Add a line for each thing you expect: passes, line breaks, entries into the box.' }));
      renderVerdict();
      return;
    }
    list.forEach(function (e, i) {
      var row = el('div', { class: 'scoutpad' });
      var met = e.target ? e.n >= +e.target : null;
      var typeSel = el('select', { style: 'width:auto;min-width:170px' });
      typeSel.appendChild(el('option', { value: '', text: '- what -' }));
      ((window.CLUB && window.CLUB.actions) || []).forEach(function (a) {
        typeSel.appendChild(el('option', { value: a.type, text: a.type }));
      });
      typeSel.appendChild(el('option', { value: '__own', text: 'Something else...' }));
      typeSel.value = ((window.CLUB.actions || []).some(function (a) { return a.type === e.type; })) ? e.type : (e.type ? '__own' : '');
      typeSel.addEventListener('change', function () {
        if (typeSel.value === '__own') {
          var v = prompt('What are you counting?', e.type || '');
          if (v) e.type = v.trim();
        } else e.type = typeSel.value;
        mark(); renderExpects();
      });
      var tgt = el('input', { type: 'number', class: 'num', min: '0', style: 'width:80px', placeholder: '3' });
      tgt.value = e.target === 0 ? '0' : (e.target || '');
      tgt.addEventListener('input', function () { e.target = tgt.value === '' ? '' : +tgt.value; mark(); renderExpects(); });

      row.appendChild(el('div', { class: 'tally-hd' }, [
        typeSel,
        el('span', { class: 'hint', text: 'expect' }), tgt,
        el('span', { class: 'chip ' + (met === null ? 'off' : (met ? 'ao' : 'dt')),
          text: met === null ? 'no target' : (met ? 'met' : 'short by ' + (+e.target - e.n)) }),
        el('span', { class: 'sp' }),
        el('button', { class: 'btn warn sm', text: 'Remove',
          onclick: function () { list.splice(i, 1); mark(); renderExpects(); } })
      ]));
      row.appendChild(el('div', { class: 'tally-row', style: 'margin-top:8px' }, [
        el('button', { class: 'tbtn minus', type: 'button', text: '\u2212',
          onclick: function () { e.n = Math.max(0, (e.n || 0) - 1); mark(); renderExpects(); } }),
        el('div', { class: 'tlab' }, [
          el('span', { text: e.type || 'counted' }),
          el('b', { text: String(e.n || 0) + (e.target !== '' && e.target != null ? ' of ' + e.target : '') })
        ]),
        el('button', { class: 'tbtn plus', type: 'button', text: '+',
          onclick: function () { e.n = (e.n || 0) + 1; mark(); renderExpects(); } })
      ]));
      host.appendChild(row);
    });
    renderVerdict();
  }

  function renderVerdict() {
    var host = document.getElementById('expVerdict');
    if (!host) return;
    host.innerHTML = '';
    var list = expList().filter(function (e) { return e.type && e.target !== '' && e.target != null; });
    if (!list.length) return;
    var met = list.filter(function (e) { return (e.n || 0) >= +e.target; }).length;
    var word = met === list.length ? 'Everything expected happened'
      : (met === 0 ? 'None of it happened' : met + ' of ' + list.length + ' happened');
    var cls = met === list.length ? 'ao' : (met === 0 ? 'dt' : 'at');
    host.appendChild(el('div', { class: 'stats' }, [
      el('div', { class: 'stat' }, [el('b', { text: met + '/' + list.length }), el('span', { text: 'Expectations met' })]),
      el('div', { class: 'stat', style: 'grid-column:span 3' }, [
        el('b', { style: 'font-size:16px;line-height:1.3' }, [el('span', { class: 'chip ' + cls, text: word })]),
        el('span', { text: 'Against what you wrote before watching' })
      ])
    ]));
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:8px',
      text: 'Writing the expectation first is the point. Counting afterwards without one tells you what happened; ' +
        'counting against one tells you whether the picture in your head was right.' }));
  }

  document.addEventListener('DOMContentLoaded', function () {
    board = new window.Board(document.getElementById('board'));
    board.onchange = function () {
      mark();
      if (window.buildBoardRail) window.buildBoardRail(board, 'rail');
      renderActions();
    };
    var list = all();
    current = list.length ? JSON.parse(JSON.stringify(list[0])) : blank();
    toForm(); clean(list.length ? 'Opened' : 'New board');
    renderActions();

    FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (!n) return;
      n.addEventListener('input', function () { current[k] = n.value; if (k === 'title') document.getElementById('bTitle').textContent = n.value || 'Board'; mark(); });
      n.addEventListener('change', function () {
        current[k] = n.value;
        if (k === 'moment') { current.phase = ''; current.principle = ''; fillSelects(); }
        if (k === 'phase') {
          if (!current.moment && n.value) {
            Object.keys(PHASES).forEach(function (m2) { if (PHASES[m2].indexOf(n.value) >= 0) current.moment = m2; });
          }
          fillSelects();
        }
        mark();
      });
    });

    on('boardSel', 'change', function () {
      if (dirty && !confirm('Switch board and lose the unsaved changes?')) { this.value = current.id; return; }
      load(this.value);
    });
    on('btnNew', 'click', function () {
      if (dirty && !confirm('Start a new board and lose the unsaved changes?')) return;
      current = blank(); toForm(); clean('New board');
    });
    on('btnDup', 'click', function () {
      current.state = board.getState();
      var copy = JSON.parse(JSON.stringify(current));
      copy.id = blank().id;
      copy.title = (copy.title || 'Board') + ' copy';
      current = copy; toForm(); mark();
    });
    on('btnPng', 'click', function () {
      var url = window.renderBoardPNG(board.getState(), 2, board.bg);
      var a = document.createElement('a');
      a.href = url;
      a.download = (current.title || 'board').replace(/[^\w-]+/g, '_') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
    on('btnDel', 'click', function () {
      var d = read();
      if (!d[current.id]) { S.toast('This board has not been saved yet.'); return; }
      if (!confirm('Delete this board?')) return;
      delete d[current.id]; write(d);
      var rest = all();
      current = rest.length ? JSON.parse(JSON.stringify(rest[0])) : blank();
      toForm(); clean('Deleted');
    });
    document.getElementById('btnXI').addEventListener('click', function () {
      var d;
      try { d = JSON.parse(localStorage.getItem('ncfc.gamemodel.v1') || '{}') || {}; } catch (e) { d = {}; }
      var forms = (d.formations || []).filter(function (f) { return f.shapeIn || f.shapeOut; });
      var shapes = forms.map(function (f) { return (f.name || '') + ' \u2014 ' + (f.shapeIn || f.shapeOut); });
      var pick = shapes.length
        ? prompt('Which formation?\n\n' + shapes.map(function (x, i) { return (i + 1) + ') ' + x; }).join('\n') +
            '\n\nOr type a shape such as 4-3-3', '1')
        : prompt('Type a shape, such as 4-3-3', '4-3-3');
      if (!pick) return;
      var shape = pick;
      var idx = parseInt(pick, 10) - 1;
      if (forms[idx] && String(idx + 1) === pick.trim()) shape = forms[idx].shapeIn || forms[idx].shapeOut;
      var objs = window.Lineup.layout(shape, { color: board.color });
      if (!objs.length) { S.toast('Could not read that shape.'); return; }
      board.snap();
      board.state.objects = board.state.objects.concat(objs);
      board.draw();
      mark();
      renderActions();
      S.toast(objs.length + ' players placed. Drag any of them, and use Names to letter them up.');
    });

    document.getElementById('btnNames').addEventListener('click', function () {
      /* put the roster onto the shirts, in number order where they match */
      var people = roster();
      if (!people.length) { S.toast('No roster on this plan yet.'); return; }
      var placed = 0;
      board.snap();
      board.state.objects.forEach(function (o) {
        if (o.type !== 'tri' && o.type !== 'cir') return;
        var p = people.filter(function (x) { return String(x.number) === String(o.n); })[0];
        if (p) { o.name = p.name; o.playerId = p.id; placed++; }
      });
      board.draw(); mark();
      S.toast(placed ? placed + ' shirts matched to the roster.' : 'No shirt numbers matched a player.');
    });

    document.getElementById('btnXI').addEventListener('click', function () { pickXI(); });
    on('btnClipMode', 'click', function () {
      board.state.field = 'clip';
      board.draw();
      setMode(true);
      if (window.buildBoardRail) window.buildBoardRail(board, 'rail');
      mark();
    });
    on('btnPitchMode', 'click', function () {
      board.state.field = 'full';
      board.draw();
      setMode(false);
      if (window.buildBoardRail) window.buildBoardRail(board, 'rail');
      mark();
    });
    function on(id, ev, fn) { var n = document.getElementById(id); if (n) n.addEventListener(ev, fn); }
    on('f_expectType', 'change', function () { current.expectType = this.value; mark(); renderExpect(); });
    on('fixSel', 'change', function () { loadSheet(this.value); });
    on('shapeSel', 'change', function () {
      if (sheet) { sheet.formation = this.value; mark(); }
    });
    on('gameLen', 'input', function () {
      if (sheet) { sheet.length = +this.value || 80; mark(); renderSheet(); }
    });
    on('btnPlaceXI', 'click', placeXI);
    on('btnPlaceOpp', 'click', placeOpp);
    on('btnClearPitch', 'click', clearPitch);
    on('oppShapeSel', 'change', function () { if (sheet) { sheet.oppFormation = this.value; mark(); } });
    on('oppName', 'input', function () { if (sheet) { sheet.oppName = this.value; mark(); } });
    on('btnSaveSheet', 'click', function () {
      if (!sheet) { S.toast('Pick a fixture first.'); return; }
      if (window.Lineup.save(sheet)) { S.toast('Team sheet saved. Minutes are in the periodization plan.'); fillFixtures(); }
    });
    var q2 = new URLSearchParams(location.search);
    loadSheet(q2.get('fixture') || '');
    on('btnSave', 'click', save);
    var ph = document.getElementById('f_phase');
    if (ph) {
    var addPh = el('button', { class: 'btn ghost sm no-print', type: 'button',
      style: 'margin-top:5px;width:100%;justify-content:center', text: '+ Add a phase' });
    addPh.addEventListener('click', function () {
      var v = prompt('New phase');
      if (!v) return;
      window.Lists.add('phases', v);
      current.phase = v.trim();
      fillSelects(); mark();
      S.toast('Added. It is in the phase list everywhere from now on.');
    });
    ph.parentNode.appendChild(addPh);
    }
    on('btnAddExp', 'click', function () {
      expList().push({ type: '', target: '', n: 0 });
      mark(); renderExpects();
    });
    on('btnClearExp', 'click', function () {
      if (!confirm('Set every count back to zero? The expectations stay.')) return;
      expList().forEach(function (e) { e.n = 0; });
      mark(); renderExpects();
    });
    on('btnActCsv', 'click', actionsCSV);
    if (window.Autosave) window.Autosave.register({
      save: function () { save(); }, isDirty: function () { return dirty; }
    });
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
      if (e.key === 'Delete' && document.activeElement === document.body) board.deleteSel();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); board.duplicateSel(); }
    });
  });
})();

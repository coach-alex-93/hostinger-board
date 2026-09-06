/* scout-page.js — counting a game, and turning it into a benchmark */
(function () {
  'use strict';
  var S = window.Store, Sc = window.Scout, K = window.KPI, el = S.el;
  var rec = null, dirty = false, running = false, t0 = null, elapsed = 0, tick = null;
  var FIELDS = ['date', 'teamA', 'teamB', 'level', 'competition', 'length', 'video', 'note'];

  function mark() { dirty = true; document.getElementById('saveState').textContent = 'Unsaved'; }
  function clean(t) { dirty = false; document.getElementById('saveState').textContent = t || 'Saved'; }
  function now() { return elapsed + (running && t0 ? (Date.now() - t0) / 1000 : 0); }
  function mins() { return Math.floor(now() / 60); }
  function mmss(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60); return m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }

  /* ---------- the clock ----------
     Built once. Rebuilding it on every tick would leave the interval writing to
     an element no longer on the page, which is exactly how it looked frozen. */
  var readEl = null, startBtn = null;
  function paint() { if (readEl) readEl.textContent = mmss(now()); }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function startTick() { stopTick(); tick = setInterval(paint, 250); }
  function clockButtons() {
    if (!startBtn) return;
    startBtn.textContent = running ? 'Pause' : (now() ? 'Resume' : 'Start');
    startBtn.className = 'btn ' + (running ? 'ghost' : 'turf');
    paint();
  }
  function buildClock() {
    var host = document.getElementById('clock');
    if (!host || readEl) { clockButtons(); return; }
    host.innerHTML = '';
    readEl = el('b', { text: mmss(now()) });
    host.appendChild(el('div', { class: 'ivreadout' }, [readEl, el('span', { class: 'ivlab', text: 'match clock' })]));
    startBtn = el('button', { class: 'btn turf', text: 'Start' });
    startBtn.addEventListener('click', function () {
      if (running) { elapsed = now(); running = false; stopTick(); }
      else { t0 = Date.now(); running = true; startTick(); }
      clockButtons();
    });
    host.appendChild(startBtn);
    host.appendChild(el('button', {
      class: 'btn ghost sm', text: 'Set',
      onclick: function () {
        var v = prompt('Set the clock to (mm:ss)', mmss(now()));
        if (v === null) return;
        var b = String(v).split(':');
        elapsed = b.length > 1 ? (+b[0]) * 60 + (+b[1]) : (+b[0] || 0) * 60;
        if (running) t0 = Date.now();
        clockButtons();
      }
    }));
    host.appendChild(el('button', {
      class: 'btn ghost sm', text: 'Reset',
      onclick: function () {
        if (now() && !confirm('Reset the match clock to zero? The counts stay.')) return;
        stopTick(); running = false; elapsed = 0; t0 = null; clockButtons();
      }
    }));
    host.appendChild(el('span', { class: 'hint',
      text: 'The clock stamps a minute against each tap. You can count without it running.' }));
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopTick(); else if (running) { startTick(); paint(); }
    });
  }
  function renderClock() { buildClock(); clockButtons(); }

  /* ---------- where on the field ----------
     A tap carries the third and the channel it happened in, so the same count
     can be read as a distribution rather than a single number. */
  var THIRDS = ['Defensive', 'Middle', 'Attacking'];
  var LANES = ['Left', 'Central', 'Right'];

  /* ---------- who and what ---------- */
  function renderWho() {
    var seg = document.getElementById('whoSeg');
    seg.innerHTML = '';
    [['A', rec.teamA || 'Team A'], ['B', rec.teamB || 'Team B']].forEach(function (x) {
      var b = el('button', { type: 'button', text: x[1], 'aria-pressed': rec.watching === x[0] ? 'true' : 'false' });
      b.addEventListener('click', function () { rec.watching = x[0]; renderWho(); renderPads(); mark(); });
      seg.appendChild(b);
    });
  }

  var zone = 'Middle third';
  var ZONES = ['Defensive third', 'Middle third', 'Attacking third'];
  var LANES = ['Left', 'Central', 'Right'];
  var lane = 'Central';

  function renderZone() {
    var host = document.getElementById('zonePicker');
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px',
      text: 'Where it happened \u00b7 every tap is stamped with this' }));
    var grid = el('div', { class: 'thirdsgrid' });
    /* attacking third at the top, the way the board is drawn */
    ZONES.slice().reverse().forEach(function (z) {
      LANES.forEach(function (ln) {
        var on = zone === z && lane === ln;
        var b = el('button', { type: 'button', class: 'thirdcell' + (on ? ' on' : ''),
          title: z + ' \u00b7 ' + ln });
        b.appendChild(el('b', { text: ln }));
        b.appendChild(el('span', { text: z.replace(' third', '') }));
        b.addEventListener('click', function () { zone = z; lane = ln; renderZone(); });
        grid.appendChild(b);
      });
    });
    host.appendChild(grid);
  }

  function chosen() {
    if (!rec.counting || !rec.counting.length) {
      rec.counting = ['Pass', 'Line-breaking pass', 'Shot', 'Dribble', 'Press'];
    }
    return rec.counting;
  }

  function renderPads() {
    var host = document.getElementById('pads');
    host.innerHTML = '';
    var t = Sc.tally(rec, rec.watching);
    chosen().forEach(function (type) {
      var c = t[type] || { n: 0, ok: 0 };
      var words = Sc.successWords(type);
      var card = el('div', { class: 'scoutpad' });
      card.appendChild(el('div', { class: 'tally-hd' }, [
        el('b', { text: type }),
        el('span', { class: 'chip', text: c.n ? c.ok + ' of ' + c.n + '  ' + Math.round(c.ok / c.n * 100) + '%' : 'none yet' }),
        el('span', { class: 'hint', style: 'margin-left:auto',
          text: words.length ? 'counts as success: ' + words.join(', ') : '' })
      ]));
      var row = el('div', { class: 'tally-row', style: 'margin-top:8px' });
      row.appendChild(el('button', { class: 'tbtn plus', type: 'button', text: '\u2713',
        title: 'It came off', onclick: function () { add(type, true); } }));
      row.appendChild(el('div', { class: 'tlab' }, [
        el('span', { text: 'per 90' }),
        el('b', { text: c.n ? Sc.per90(c.n, rec.length).toFixed(0) : '0' })
      ]));
      row.appendChild(el('button', { class: 'tbtn minus', type: 'button', text: '\u2717',
        title: 'It did not', onclick: function () { add(type, false); } }));
      card.appendChild(row);
      host.appendChild(card);
    });
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:10px',
      text: (rec.events || []).length + ' events recorded. Every tap saves.' }));
  }

  function add(type, ok) {
    rec.events = rec.events || [];
    rec.events.push({ t: mins(), team: rec.watching, type: type, ok: !!ok,
      zone: zone, lane: lane, player: keyFocus || '' });
    Sc.save(rec);
    clean('Saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    renderPads(); renderThis(); renderBench(); renderKeys();
  }

  /* ---------- key players ----------
     Watching a level up is usually about two or three players. Naming them
     lets a tap be attributed without pretending to track a full squad. */
  var keyFocus = '';
  function renderKeys() {
    var host = document.getElementById('keys');
    if (!host) return;
    host.innerHTML = '';
    rec.keyPlayers = rec.keyPlayers || [];
    if (!rec.keyPlayers.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0 0 8px',
        text: 'None named. Add the two or three you are actually watching.' }));
    }
    rec.keyPlayers.forEach(function (k, i) {
      var row = el('div', { class: 'grid g4', style: 'margin-bottom:6px;align-items:end' });
      function f(key, label, ph) {
        var n = el('input', { type: 'text', placeholder: ph || '' });
        n.value = k[key] || '';
        n.addEventListener('input', function () { k[key] = n.value; mark(); renderKeyChips(); });
        return el('label', { class: 'f' }, [el('span', { text: label }), n]);
      }
      row.appendChild(f('num', 'No.', '7'));
      row.appendChild(f('name', 'Name or description', 'tall left winger'));
      row.appendChild(f('pos', 'Position', 'WF'));
      var note = el('input', { type: 'text', placeholder: 'where they actually play, what they do' });
      note.value = k.note || '';
      note.addEventListener('input', function () { k.note = note.value; mark(); });
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Positioning' }), note]));
      host.appendChild(row);
      host.appendChild(el('div', { class: 'btnrow', style: 'margin:-2px 0 10px' }, [
        el('button', { class: 'btn warn sm', text: 'Remove',
          onclick: function () { rec.keyPlayers.splice(i, 1); renderKeys(); renderKeyChips(); mark(); } })
      ]));
    });
    host.appendChild(el('button', { class: 'btn ghost sm', text: '+ Add a key player',
      onclick: function () { rec.keyPlayers.push({ num: '', name: '', pos: '', note: '' }); renderKeys(); mark(); } }));
  }

  function renderKeyChips() {
    var host = document.getElementById('keyChips');
    if (!host) return;
    host.innerHTML = '';
    var named = (rec.keyPlayers || []).filter(function (k) { return k.num || k.name; });
    if (!named.length) return;
    host.appendChild(el('span', { class: 'hint', text: 'Attribute taps to:' }));
    var seg = el('div', { class: 'seg', style: 'flex-wrap:wrap;max-width:none' });
    [{ id: '', label: 'Nobody' }].concat(named.map(function (k) {
      var lbl = [k.num, k.name].filter(Boolean).join(' ');
      return { id: lbl, label: lbl };
    })).forEach(function (o) {
      var b = el('button', { type: 'button', text: o.label, 'aria-pressed': keyFocus === o.id ? 'true' : 'false' });
      b.addEventListener('click', function () { keyFocus = o.id; renderKeyChips(); });
      seg.appendChild(b);
    });
    host.appendChild(seg);
  }

  /* ---------- key players ----------
     A number is enough to watch someone. A name and a position makes the count
     say something about them rather than about the team. */
  function renderKeys() {
    var host = document.getElementById('keys');
    if (!host) return;
    host.innerHTML = '';
    rec.keys = rec.keys || [];
    if (!rec.keys.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'None yet. Add the numbers you are watching and every tap can be attributed to one of them.' }));
    }
    var seg = el('div', { class: 'seg', style: 'max-width:520px;margin-bottom:12px;flex-wrap:wrap' });
    seg.appendChild((function () {
      var b = el('button', { type: 'button', text: 'Team, not a player',
        'aria-pressed': rec.focusPlayer ? 'false' : 'true' });
      b.addEventListener('click', function () { rec.focusPlayer = ''; renderKeys(); mark(); });
      return b;
    })());
    rec.keys.forEach(function (k, i) {
      var lbl = [k.num, k.name].filter(Boolean).join(' ') || 'player ' + (i + 1);
      var b = el('button', { type: 'button', text: lbl,
        'aria-pressed': rec.focusPlayer === lbl ? 'true' : 'false' });
      b.addEventListener('click', function () { rec.focusPlayer = lbl; renderKeys(); mark(); });
      seg.appendChild(b);
    });
    if (rec.keys.length) host.appendChild(seg);

    rec.keys.forEach(function (k, i) {
      var num = el('input', { type: 'text', class: 'num', maxlength: 3, placeholder: '10' });
      num.value = k.num || '';
      num.addEventListener('input', function () { k.num = num.value; mark(); });
      var nm = el('input', { type: 'text', placeholder: 'name, if you know it' });
      nm.value = k.name || '';
      nm.addEventListener('input', function () { k.name = nm.value; mark(); });
      var pos = el('select');
      pos.appendChild(el('option', { value: '', text: '- position -' }));
      ((window.CLUB && window.CLUB.positions) || []).forEach(function (x) {
        pos.appendChild(el('option', { value: x.code, text: x.code + ' \u00b7 ' + x.name }));
      });
      pos.value = k.pos || '';
      pos.addEventListener('change', function () { k.pos = pos.value; mark(); });
      var note = el('input', { type: 'text', placeholder: 'where they start, and where they end up' });
      note.value = k.note || '';
      note.addEventListener('input', function () { k.note = note.value; mark(); });

      var counted = (rec.events || []).filter(function (e) {
        return e.player === ([k.num, k.name].filter(Boolean).join(' ') || 'player ' + (i + 1));
      }).length;

      host.appendChild(el('div', { class: 'grid g5', style: 'margin-bottom:8px;align-items:end' }, [
        el('label', { class: 'f' }, [el('span', { text: 'No.' }), num]),
        el('label', { class: 'f' }, [el('span', { text: 'Name' }), nm]),
        el('label', { class: 'f' }, [el('span', { text: 'Position' }), pos]),
        el('label', { class: 'f' }, [el('span', { text: 'Positioning' }), note]),
        el('div', { class: 'f' }, [
          el('span', { class: 'eyebrow', style: 'margin:0', text: counted + ' tapped' }),
          el('button', { class: 'btn warn sm', style: 'margin-top:4px', text: 'Remove',
            onclick: function () { rec.keys.splice(i, 1); renderKeys(); mark(); } })
        ])
      ]));
    });
  }

  /* ---------- what this game said ---------- */
  function renderThis() {
    var host = document.getElementById('thisGame');
    host.innerHTML = '';
    ['A', 'B'].forEach(function (side) {
      var rows = Sc.summary(rec, side);
      if (!rows.length) return;
      host.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px',
        text: (side === 'A' ? (rec.teamA || 'Team A') : (rec.teamB || 'Team B')) }));
      var box = el('div', { class: 'plrows', style: 'margin-bottom:14px' });
      var max = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
      rows.forEach(function (r) {
        box.appendChild(el('div', { class: 'plrow' }, [
          el('span', { class: 'pn', text: r.type }),
          el('span', { class: 'bar' }, [el('i', { style: 'width:' + Math.round(r.n / max * 100) + '%' })]),
          el('span', { class: 'pv', text: r.n + '  \u00b7  ' + r.per90.toFixed(0) + '/90  \u00b7  ' +
            (r.rate === null ? '-' : Math.round(r.rate * 100) + '%') })
        ]));
      });
      host.appendChild(box);

      var byThird = {};
      (rec.events || []).forEach(function (e) {
        var where = e.zone || e.third;
        if (e.team !== side || !where) return;
        var t = byThird[where] = byThird[where] || { n: 0, ok: 0 };
        t.n++; if (e.ok) t.ok++;
      });
      var keys = Object.keys(byThird);
      if (keys.length) {
        var strip = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:-6px 0 14px' });
        THIRDS.forEach(function (t) {
          if (!byThird[t]) return;
          strip.appendChild(el('span', { class: 'chip',
            text: t + ' third  ' + byThird[t].ok + '/' + byThird[t].n +
              '  ' + Math.round(byThird[t].ok / byThird[t].n * 100) + '%' }));
        });
        host.appendChild(strip);
      }
    });
    if (!(rec.events || []).length) {
      host.appendChild(el('div', { class: 'empty', text: 'Nothing counted yet.' }));
    }
  }

  /* ---------- across games ---------- */
  function renderBench() {
    var sel = document.getElementById('benchLevel');
    var lv = Sc.levels();
    var keys = Object.keys(lv);
    var was = sel.value;
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '', text: 'Every level' }));
    keys.forEach(function (k) { sel.appendChild(el('option', { value: k, text: k + '  (' + lv[k] + ')' })); });
    sel.value = was || rec.level || '';

    var host = document.getElementById('bench');
    host.innerHTML = '';
    var rows = Sc.benchmark(sel.value, 'A');
    if (!rows.length) {
      host.appendChild(el('div', { class: 'empty',
        text: 'Count a game and give it a level, and the benchmark builds itself here.' }));
      return;
    }
    rows.forEach(function (r) {
      var line = el('div', { class: 'act', style: 'border-left-color:var(--' + (r.confident ? 'turf' : 'flag-deep') + ')' });
      line.appendChild(el('div', { class: 'act-hd' }, [
        el('span', { class: 'lab', text: r.type }),
        el('span', { class: 'chip', text: r.per90.toFixed(0) + ' per 90' }),
        el('span', { class: 'chip', text: r.rate === null ? '-' : Math.round(r.rate * 100) + '% success' }),
        el('span', { class: 'chip ' + (r.confident ? 'ao' : 'off'),
          text: r.games + ' game' + (r.games === 1 ? '' : 's') + (r.confident ? '' : ', too few to lean on') }),
        el('span', { class: 'sp' }),
        el('button', { class: 'btn ghost sm', text: 'Make it a KPI target',
          onclick: function () { toKPI(r, sel.value); } })
      ]));
      host.appendChild(line);
    });
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:10px',
      text: 'Green once five games sit behind it. Below that the number is a hint, not a benchmark, ' +
        'and the app says so rather than letting you set a target on one game.' }));
  }

  function toKPI(r, level) {
    if (!K) return;
    var pct = r.rate === null ? null : Math.round(r.rate * 100);
    var cat = r.type + ' success rate';
    var existing = K.all().filter(function (x) { return x.category === cat; })[0];
    var def = existing || { id: null, category: cat, principle: '', unit: 'rate' };
    def.description = 'Benchmarked at ' + (pct === null ? '-' : pct + '%') + ' and ' +
      r.per90.toFixed(0) + ' per 90, from ' + r.games + ' game' + (r.games === 1 ? '' : 's') +
      ' scouted' + (level ? ' at ' + level : '') + '.';
    def.benchmark = { rate: r.rate, per90: r.per90, games: r.games, level: level || 'all' };
    K.save(def);
    S.toast(existing ? 'KPI updated with the benchmark.' : 'KPI created. Set the target on a session.');
  }

  /* ---------- plumbing ---------- */
  function fillList() {
    var sel = document.getElementById('gameSel');
    sel.innerHTML = '';
    var list = Sc.all();
    if (!list.length) { sel.appendChild(el('option', { value: '', text: 'No games yet' })); return; }
    list.forEach(function (r) {
      sel.appendChild(el('option', { value: r.id,
        text: S.fmt(r.date) + ' \u00b7 ' + (r.teamA || '?') + ' v ' + (r.teamB || '?') +
          (r.level ? ' \u00b7 ' + r.level : '') + '  (' + (r.events || []).length + ')' }));
    });
    sel.value = rec.id;

    var dl = document.getElementById('levelList');
    dl.innerHTML = '';
    Object.keys(Sc.levels()).forEach(function (k) { dl.appendChild(el('option', { value: k })); });
  }
  function toForm() {
    FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (n) n.value = rec[k] == null ? '' : rec[k];
    });
    renderClock(); renderWho(); renderZone(); renderKeys(); renderKeyChips();
    renderPads(); renderThis(); renderBench(); fillList();
  }
  function load(id) {
    rec = Sc.get(id) || Sc.blank();
    elapsed = 0; running = false; t0 = null;
    stopTick();
    toForm(); clean('Opened');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var list = Sc.all();
    rec = list.length ? Sc.get(list[0].id) : Sc.blank();
    toForm(); clean(list.length ? 'Opened' : 'New game');

    FIELDS.forEach(function (k) {
      var n = document.getElementById('f_' + k);
      if (!n) return;
      n.addEventListener('input', function () {
        rec[k] = k === 'length' ? (+n.value || 80) : n.value;
        mark();
        if (k === 'teamA' || k === 'teamB') renderWho();
        if (k === 'length') { renderPads(); renderThis(); }
      });
    });
    document.getElementById('gameSel').addEventListener('change', function () {
      if (dirty) Sc.save(rec);
      load(this.value);
    });
    document.getElementById('btnNew').addEventListener('click', function () {
      if (dirty) Sc.save(rec);
      rec = Sc.blank(); elapsed = 0; running = false;
      toForm(); clean('New game');
    });
    document.getElementById('btnDel').addEventListener('click', function () {
      if (!Sc.get(rec.id)) { S.toast('This game has not been saved yet.'); return; }
      if (!confirm('Delete this game and its ' + (rec.events || []).length + ' events?')) return;
      Sc.remove(rec.id);
      var rest = Sc.all();
      rec = rest.length ? Sc.get(rest[0].id) : Sc.blank();
      toForm(); clean('Deleted');
    });
    document.getElementById('btnSave').addEventListener('click', function () {
      if (Sc.save(rec)) { clean(); fillList(); }
    });
    document.getElementById('btnUndo').addEventListener('click', function () {
      if (!(rec.events || []).length) return;
      rec.events.pop(); Sc.save(rec);
      renderPads(); renderThis(); renderBench();
    });
    document.getElementById('btnPickActions').addEventListener('click', function () {
      window.Lists.multiPick({
        title: 'What are you counting?', items: Sc.actionTypes(),
        onPick: function (picked) {
          rec.counting = picked;
          renderPads(); mark();
        }
      });
    });
    document.getElementById('btnAddKey').addEventListener('click', function () {
      rec.keys = rec.keys || [];
      rec.keys.push({ num: '', name: '', pos: '', note: '' });
      renderKeys(); mark();
    });
    document.getElementById('benchLevel').addEventListener('change', renderBench);
    document.getElementById('btnCsv').addEventListener('click', function () {
      var rows = [['Date', 'Level', 'Team A', 'Team B', 'Competition', 'Length', 'Side',
        'Action', 'Events', 'Successful', 'Success rate', 'Per 90']];
      Sc.all().forEach(function (r) {
        ['A', 'B'].forEach(function (side) {
          Sc.summary(r, side).forEach(function (x) {
            rows.push([r.date, r.level || '', r.teamA || '', r.teamB || '', r.competition || '',
              r.length, side === 'A' ? (r.teamA || 'A') : (r.teamB || 'B'), x.type, x.n, x.ok,
              x.rate === null ? '' : Math.round(x.rate * 1000) / 10, x.per90.toFixed(1)]);
          });
        });
      });
      if (rows.length === 1) { S.toast('Nothing counted yet.'); return; }
      S.exportAs('Scouting', rows, { title: 'Scouting counts' });
    });
    if (window.Autosave) window.Autosave.register({
      save: function () { Sc.save(rec); }, isDirty: function () { return dirty; }
    });
  });
})();

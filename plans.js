/* ============================================================
   plans.js — create and manage periodization plans
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el, esc = S.esc;

  var DAYS = [['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'],
    ['5', 'Friday'], ['6', 'Saturday'], ['0', 'Sunday']];

  var draft = null;      // the plan being edited
  var editingId = null;  // null means new

  var showArchived = false;

  /* the thresholds follow the game length unless you set them */
  function loadNote() {
    var n = document.getElementById('loadNote');
    if (!n) return;
    var len = +document.getElementById('p_gameLength').value || 80;
    var lo = document.getElementById('p_loadLow').value;
    var hi = document.getElementById('p_loadHigh').value;
    var a = lo === '' ? Math.round(len * 0.375) : +lo;
    var b = hi === '' ? Math.round(len * 1.5) : +hi;
    n.textContent = 'Training-week bands: under ' + a + ' minutes in seven days needs volume, over ' +
      b + ' needs managing. Leave the two blank and they follow the game length (' + len + ' min), ' +
      'which is why a U19 gets higher numbers than a U13.';
  }

  /* ---------- list ---------- */
  function renderList() {
    var host = document.getElementById('planList');
    host.innerHTML = '';

    var arch = S.planList(true).filter(function (p) { return p.archived; });
    if (arch.length) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = showArchived;
      cb.addEventListener('change', function () { showArchived = cb.checked; renderList(); });
      host.appendChild(el('label', { class: 'switchrow', style: 'margin-bottom:12px' }, [
        cb, el('span', { text: 'Show ' + arch.length + ' archived season' + (arch.length === 1 ? '' : 's') })
      ]));
    }
    var ul = el('ul', { class: 'list' });

    S.planList(showArchived).forEach(function (p) {
      var rows = S.planRows(p.id);
      var train = rows.filter(function (r) { return r.event === 'Training Session'; }).length;
      var games = rows.reduce(function (s, r) { return s + (r.games || 0); }, 0);
      var c = S.countFor(p.id);
      var cfg = S.planConfig(p.id) || {};

      var actions = [
        el('a', { class: 'btn ghost sm', href: 'periodization.html?plan=' + encodeURIComponent(p.id), text: 'Open' }),
        el('button', {
          class: 'btn ghost sm', text: 'Duplicate', onclick: function () {
            var name = prompt('Name for the copy', (p.short || p.label) + ' copy');
            if (!name) return;
            var made = S.duplicatePlan(p.id, name);
            if (made) { S.toast('Copied. The copy is editable.'); renderList(); }
          }
        })
      ];
      actions.push(el('button', {
        class: 'btn ghost sm', text: 'New season',
        title: 'Same squad, new dates. The roster and coaches come across; last year\'s sessions do not',
        onclick: function () {
          var label = prompt('Name the new season', p.label.replace(/\b20\d\d(-\d\d)?\b/, '') .trim() + ' 2027-28');
          if (!label) return;
          var start = prompt('Season starts (YYYY-MM-DD)', '');
          if (start === null) return;
          var end = prompt('Season ends (YYYY-MM-DD)', '');
          if (end === null) return;
          var made = S.newSeasonFrom(p.id, label.trim(), start.trim(), end.trim());
          if (!made) { S.toast('Could not copy that plan.'); return; }
          S.toast('Created ' + made.short + (made.carried ? ' with ' + made.carried + ' players carried across' : '') +
            '. Fixtures and sessions start empty.');
          renderList();
        }
      }));
      actions.push(el('button', {
        class: 'btn ghost sm', text: p.archived ? 'Restore' : 'Archive',
        title: p.archived ? 'Bring it back into the switchers'
          : 'A finished season: everything is kept, it just stops appearing in the switchers',
        onclick: function () {
          if (!p.archived) {
            var w = S.footprintWords(p.id);
            if (!confirm('Archive ' + p.short + '?\n\n' +
              (w ? 'Everything on it goes with it: ' + w + '. Nothing is deleted, it just stops appearing.'
                 : 'Nothing is attached to it yet.') +
              '\n\nTick Show archived to reach it again.')) return;
          }
          S.archivePlan(p.id, !p.archived);
          S.toast(p.archived ? 'Restored.' : 'Archived, with everything on it.');
          renderList();
        }
      }));
      if (!p.builtin) {
        actions.push(el('button', { class: 'btn ghost sm', text: 'Edit', onclick: function () { edit(p.id); } }));
        actions.push(el('button', {
          class: 'btn warn sm', text: 'Delete', onclick: function () {
            if (!confirm('Delete "' + p.label + '"?\n\nIts row edits go too. ' +
              (c.sessions ? c.sessions + ' saved session(s) against it, drafts included, will be kept unless you tick below.' : ''))) return;
            var alsoSess = c.sessions ? confirm('Also delete the ' + c.sessions + ' saved session(s) against this plan, drafts included?') : false;
            S.deletePlanConfig(p.id, alsoSess);
            S.toast('Plan deleted.'); renderList();
          }
        }));
      }

      ul.appendChild(el('li', {}, [
        el('span', { class: 'chip ' + (p.archived ? 'off' : (p.builtin ? '' : 'at')),
          text: p.archived ? 'Archived' : (p.builtin ? 'Built in' : 'Yours') }),
        el('div', { class: 'grow' }, [
          el('div', { class: 'ttl', text: p.label }),
          el('div', {
            class: 'sub', text: [
              cfg.start ? S.fmt(cfg.start) + ' to ' + S.fmt(cfg.end) : '',
              train + ' training days', games + ' games',
              c.edits ? c.edits + ' rows edited' : 'no row edits',
              c.sessions ? S.tallyWords(p.id) : 'no sessions'
            ].filter(Boolean).join(' · ')
          })
        ])
      ].concat(actions)));
    });

    host.appendChild(ul);
    host.appendChild(el('div', { class: 'btnrow', style: 'margin-top:14px' }, [
      el('button', { class: 'btn turf', text: 'Start a blank plan', onclick: function () { edit(null); } })
    ]));
  }

  /* ---------- form ---------- */
  function blankDraft() {
    var y = new Date().getFullYear();
    return {
      id: null, label: '', short: '',
      start: y + '-08-01', end: y + '-12-15',
      training: {}, gameDuration: '2x45', blocks: [], fixtures: []
    };
  }

  function edit(id) {
    editingId = id;
    draft = id ? JSON.parse(JSON.stringify(S.planConfig(id))) : blankDraft();
    document.getElementById('formTitle').textContent = id ? 'Edit plan' : 'New plan';
    document.getElementById('formHint').textContent = id
      ? 'Changes apply the moment you save. Row edits and sessions on dates that still exist are kept.'
      : 'Start from an empty calendar.';
    fillForm();
    document.getElementById('formTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fillForm() {
    document.getElementById('p_label').value = draft.label || '';
    document.getElementById('p_start').value = draft.start || '';
    document.getElementById('p_end').value = draft.end || '';
    document.getElementById('p_gameDur').value = draft.gameDuration || '';
    document.getElementById('p_gameLength').value = draft.gameLength || '';
    document.getElementById('p_loadLow').value = draft.loadLow == null ? '' : draft.loadLow;
    document.getElementById('p_loadHigh').value = draft.loadHigh == null ? '' : draft.loadHigh;
    loadNote();
    renderTrainDays();
    renderBlocks();
    renderFixSummary();
    document.getElementById('preview').innerHTML = '';
  }

  function renderTrainDays() {
    var host = document.getElementById('trainDays');
    host.innerHTML = '';
    DAYS.forEach(function (d) {
      var inp = el('input', { type: 'number', class: 'num', min: '0', max: '240', step: '5', placeholder: 'rest' });
      inp.value = draft.training[d[0]] || '';
      inp.addEventListener('input', function () {
        var v = parseInt(inp.value, 10);
        if (v > 0) draft.training[d[0]] = v; else delete draft.training[d[0]];
      });
      host.appendChild(el('label', { class: 'f' }, [el('span', { text: d[1] + ' (min)' }), inp]));
    });
  }

  function renderBlocks() {
    var host = document.getElementById('blocks');
    host.innerHTML = '';
    if (!draft.blocks.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'No blocks. The plan will run as one continuous stretch.' }));
      return;
    }
    draft.blocks.forEach(function (b, i) {
      var row = el('div', { class: 'grid g4', style: 'margin-bottom:8px;align-items:end' });
      var name = el('input', { type: 'text', value: b.name || '', placeholder: 'Block 1' });
      name.addEventListener('input', function () { b.name = name.value; });
      var st = el('input', { type: 'date', value: b.start || '' });
      st.addEventListener('input', function () { b.start = st.value; });
      var en = el('input', { type: 'date', value: b.end || '' });
      en.addEventListener('input', function () { b.end = en.value; });
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Name' }), name]));
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'From' }), st]));
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'To' }), en]));
      row.appendChild(el('button', {
        class: 'btn warn sm', text: 'Remove',
        onclick: function () { draft.blocks.splice(i, 1); renderBlocks(); }
      }));
      host.appendChild(row);
    });
  }

  function renderFixSummary() {
    var n = draft.fixtures.length;
    var host = document.getElementById('fixSummary');
    if (!n) { host.textContent = 'No fixtures. Every non-training day will read OFF and GD numbering stays blank.'; return; }
    var first = draft.fixtures.map(function (f) { return f.date; }).sort();
    host.textContent = n + ' fixture' + (n === 1 ? '' : 's') + ', ' + S.fmt(first[0]) + ' to ' + S.fmt(first[first.length - 1]) + '.';
  }

  function collect() {
    draft.label = document.getElementById('p_label').value.trim();
    draft.short = draft.label;
    draft.start = document.getElementById('p_start').value;
    draft.end = document.getElementById('p_end').value;
    draft.gameDuration = document.getElementById('p_gameDur').value.trim() || '2x45';
    var gl = document.getElementById('p_gameLength').value;
    var ll = document.getElementById('p_loadLow').value;
    var lh = document.getElementById('p_loadHigh').value;
    draft.gameLength = gl === '' ? null : +gl;
    draft.loadLow = ll === '' ? null : +ll;
    draft.loadHigh = lh === '' ? null : +lh;
    return draft;
  }

  function validate(c) {
    if (!c.label) return 'Give the plan a name.';
    if (!c.start || !c.end) return 'Set both a start and an end date.';
    if (c.end < c.start) return 'The end date falls before the start date.';
    var span = (new Date(c.end) - new Date(c.start)) / 86400000;
    if (span > 800) return 'That span is over two years. Split it into separate plans.';
    if (!Object.keys(c.training).length && !c.fixtures.length) return 'Set at least one training day, or import some fixtures.';
    return '';
  }

  function savePlan() {
    var c = collect();
    var err = validate(c);
    if (err) { S.toast(err); return; }
    if (editingId) c.id = editingId;
    var saved = S.savePlanConfig(c);
    if (!saved) return;
    S.setPref('squad', saved.id);
    S.toast('Plan saved.');
    editingId = null;
    draft = blankDraft();
    fillForm();
    document.getElementById('formTitle').textContent = 'New plan';
    renderList();
  }

  function preview() {
    var c = collect();
    var err = validate(c);
    var host = document.getElementById('preview');
    if (err) { host.innerHTML = '<div class="empty">' + esc(err) + '</div>'; return; }
    var rows = window.SeasonGen.build(c);
    var train = rows.filter(function (r) { return r.event === 'Training Session'; });
    var games = rows.reduce(function (s, r) { return s + (r.games || 0); }, 0);
    var mins = train.reduce(function (s, r) { return s + (r.mins || 0); }, 0);
    var weeks = rows.length ? rows[rows.length - 1].week : 0;

    host.innerHTML = '';
    var strip = el('div', { class: 'season-ribbon' });
    rows.forEach(function (r) {
      var cl = r.event === 'Training Session' ? 'train' : (r.event.indexOf('Game') === 0 ? 'game' : '');
      var h = r.event === 'Training Session' ? 72 : (r.event.indexOf('Game') === 0 ? 100 : 22);
      strip.appendChild(el('div', {
        class: 'sr-day ' + cl, style: 'height:' + h + '%',
        title: S.dow(r.date) + ' ' + S.fmt(r.date) + ' · ' + r.event
      }));
    });
    host.appendChild(strip);
    var st = el('div', { class: 'stats', style: 'margin-top:14px' });
    [[rows.length, 'Days'], [weeks, 'Weeks'], [train.length, 'Training days'],
     [games, 'Games'], [Math.round(mins / 60) + 'h', 'Training time']].forEach(function (x) {
      st.appendChild(el('div', { class: 'stat' }, [el('b', { text: String(x[0]) }), el('span', { text: x[1] })]));
    });
    host.appendChild(st);
  }

  /* ---------- fixtures ---------- */
  function importFixtures() {
    S.pickFile('.csv,text/csv', function (text) {
      var year = parseInt((document.getElementById('p_start').value || '').slice(0, 4), 10) || new Date().getFullYear();
      var probe = window.SeasonGen.fixturesFromCSV(text, { year: year });
      if (!probe.fixtures.length && !probe.teams.length) { S.toast('No fixtures found. Check the file has a Date column.'); return; }

      var team = '';
      if (probe.teams.length > 1) {
        team = prompt('That file covers ' + probe.teams.length + ' teams (' + probe.teams.join(', ') +
          ').\n\nType one to import just that team, or leave blank for all.', probe.teams[0]) || '';
      }
      var res = window.SeasonGen.fixturesFromCSV(text, { year: year, team: team.trim() });
      if (!res.fixtures.length) { S.toast('Nothing matched. Check the team name.'); return; }

      draft.fixtures = res.fixtures;
      var dates = res.fixtures.map(function (f) { return f.date; }).sort();
      if (!document.getElementById('p_start').value || dates[0] < document.getElementById('p_start').value) {
        document.getElementById('p_start').value = dates[0];
        draft.start = dates[0];
      }
      if (!document.getElementById('p_end').value || dates[dates.length - 1] > document.getElementById('p_end').value) {
        document.getElementById('p_end').value = dates[dates.length - 1];
        draft.end = dates[dates.length - 1];
      }
      renderFixSummary();
      S.toast(res.fixtures.length + ' fixtures read' + (res.skipped ? ', ' + res.skipped + ' rows skipped for an unreadable date.' : '.'));
    });
  }

  /* ---------- templates ---------- */
  function exportTemplate() {
    var list = S.planList(showArchived);
    var names = list.map(function (p, i) { return (i + 1) + ') ' + p.label; }).join('\n');
    var pick = prompt('Export which plan as a template?\n\n' + names, '1');
    var idx = parseInt(pick, 10) - 1;
    if (!(idx >= 0 && idx < list.length)) return;
    var p = list[idx];
    var cfg = JSON.parse(JSON.stringify(S.planConfig(p.id)));
    cfg.builtin = false;

    var withSeq = confirm('Include the principle sequencing and row notes you have set against this plan?\n\nOK includes them. Cancel exports the bare calendar.');
    var rowEdits = {};
    if (withSeq) {
      var all = S.plan();
      Object.keys(all).forEach(function (k) {
        if (k.indexOf(p.id + '|') === 0) rowEdits[k.split('|')[1]] = all[k];
      });
    }
    S.download('Plan_' + p.label.replace(/[^\w-]+/g, '_') + '.json', JSON.stringify({
      kind: 'sessionboard.plan', version: 1, exported: new Date().toISOString(),
      config: cfg, rowEdits: rowEdits
    }, null, 1));
  }

  function importTemplate() {
    S.pickFile('.json', function (text) {
      var j;
      try { j = JSON.parse(text); } catch (e) { S.toast('That file is not valid JSON.'); return; }
      if (j.kind !== 'sessionboard.plan' || !j.config) { S.toast('That is not a plan template.'); return; }
      var cfg = j.config;
      cfg.id = S.newPlanId();
      cfg.builtin = false;
      cfg.label = prompt('Name this plan', cfg.label || 'Imported plan') || cfg.label || 'Imported plan';
      cfg.short = cfg.label;
      if (!S.savePlanConfig(cfg)) return;

      var n = 0;
      Object.keys(j.rowEdits || {}).forEach(function (date) {
        var e = Object.assign({}, j.rowEdits[date]);
        delete e.sessionId;                     // sessions do not travel with a template
        S.setPlan(cfg.id, date, e); n++;
      });
      S.toast('Plan imported' + (n ? ' with ' + n + ' rows of sequencing.' : '.'));
      renderList();
    });
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    draft = blankDraft();
    fillForm();
    renderList();

    document.getElementById('btnAddBlock').addEventListener('click', function () {
      draft.blocks.push({ name: 'Block ' + (draft.blocks.length + 1), start: draft.start, end: draft.end });
      renderBlocks();
    });
    document.getElementById('btnEvenBlocks').addEventListener('click', function () {
      collect();
      if (!draft.start || !draft.end) { S.toast('Set the start and end dates first.'); return; }
      var a = new Date(draft.start + 'T12:00:00'), b = new Date(draft.end + 'T12:00:00');
      var total = Math.round((b - a) / 86400000), step = Math.floor(total / 4);
      var iso = function (d) {
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      };
      draft.blocks = [];
      for (var i = 0; i < 4; i++) {
        var s0 = new Date(a.getTime()); s0.setDate(s0.getDate() + i * step);
        var e0 = i === 3 ? b : (function () { var x = new Date(a.getTime()); x.setDate(x.getDate() + (i + 1) * step - 1); return x; })();
        draft.blocks.push({ name: 'Block ' + (i + 1), start: iso(s0), end: iso(e0) });
      }
      renderBlocks();
    });

    ['p_gameLength', 'p_loadLow', 'p_loadHigh'].forEach(function (k) {
      var n = document.getElementById(k);
      if (n) n.addEventListener('input', loadNote);
    });
    document.getElementById('btnFixCsv').addEventListener('click', importFixtures);
    document.getElementById('btnFixClear').addEventListener('click', function () {
      if (!draft.fixtures.length) return;
      if (!confirm('Remove all ' + draft.fixtures.length + ' fixtures from this plan?')) return;
      draft.fixtures = []; renderFixSummary();
    });

    document.getElementById('btnSavePlan').addEventListener('click', savePlan);
    document.getElementById('btnPreview').addEventListener('click', preview);
    document.getElementById('btnCancel').addEventListener('click', function () {
      editingId = null; draft = blankDraft(); fillForm();
      document.getElementById('formTitle').textContent = 'New plan';
    });
    document.getElementById('btnExportTpl').addEventListener('click', exportTemplate);
    document.getElementById('btnImportTpl').addEventListener('click', importTemplate);
  });
})();

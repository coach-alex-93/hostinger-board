/* ============================================================
   depth.js — depth chart by position
   Shares the roster with the IDP sheets: one player list, two views.
   Laid out to match the club chart: Rank, Player, Qtr. Born, age group,
   the positions she covers.
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el, esc = S.esc;

  var K_IDP = 'ncfc.idp.v1';
  var QTRS = ['', 'Q1', 'Q2', 'Q3', 'Q4'];
  var QTR_MONTHS = { Q1: 'Aug-Oct', Q2: 'Nov-Jan', Q3: 'Feb-Apr', Q4: 'May-Jul' };

  /* Shirt numbers per role, so the chart reads the way the club's does */
  var SLOTS = [
    { code: 'GK', name: 'Goalkeeper', nums: '1', row: 1, col: 2 },
    { code: 'CB', name: 'Center Back', nums: '4, 5', row: 2, col: 2 },
    { code: 'OB', name: 'Outside Back', nums: '2, 3', row: 2, col: 1 },
    { code: 'CDM', name: 'Center Defensive Mid', nums: '6', row: 3, col: 2 },
    { code: 'CM', name: 'Central Mid', nums: '8', row: 3, col: 3 },
    { code: 'AM', name: 'Attacking Mid', nums: '10', row: 4, col: 2 },
    { code: 'WF', name: 'Wide Forward', nums: '7, 11', row: 4, col: 1 },
    { code: 'CF', name: 'Center Forward', nums: '9', row: 5, col: 2 }
  ];

  var plan = S.defaultPlanId();

  function read() { try { return JSON.parse(localStorage.getItem(K_IDP) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(K_IDP, JSON.stringify(d)); return true; }
    catch (e) { S.toast('Could not save.'); return false; }
  }
  function db() { var d = read(); d.players = d.players || {}; return d; }

  /* The season runs 1 August to 31 July, so a birth year band is written
     2013-14 and the age group counts from the August the season starts. */
  function seasonYearOf(iso) {
    if (!iso) return null;
    var y = +iso.slice(0, 4), m = +iso.slice(5, 7);
    return m >= 8 ? y : y - 1;
  }
  function currentSeasonYear() {
    var d = new Date(), m = d.getMonth() + 1;
    return m >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  }
  function bandOf(iso) {
    var sy = seasonYearOf(iso);
    return sy === null ? '' : sy + '-' + String(sy + 1).slice(2);
  }
  function ageGroupOf(iso) {
    var sy = seasonYearOf(iso);
    if (sy === null) return '';
    return 'U' + (currentSeasonYear() - sy + 1);
  }
  function ageNow(iso) {
    if (!iso) return '';
    var b = new Date(iso + 'T12:00:00'), n = new Date();
    var y = n.getFullYear() - b.getFullYear();
    var m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) { y--; m += 12; }
    if (n.getDate() < b.getDate()) m--;
    if (m < 0) m += 12;
    return y + 'y ' + m + 'm';
  }

  function qtrFromDOB(iso) {
    if (!iso) return '';
    var m = parseInt(iso.slice(5, 7), 10);
    if (m >= 8 && m <= 10) return 'Q1';
    if (m === 11 || m === 12 || m === 1) return 'Q2';
    if (m >= 2 && m <= 4) return 'Q3';
    return 'Q4';
  }

  function players() {
    var d = db(), out = [];
    Object.keys(d.players).forEach(function (k) { if (d.players[k].plan === plan) out.push(d.players[k]); });
    return out;
  }
  function set(id, patch) {
    var d = db();
    if (!d.players[id]) return;
    d.players[id] = Object.assign({}, d.players[id], patch);
    write(d);
  }

  /* covers(): a player's position is her primary; covers is the wider list */
  function covers(p) {
    var c = (p.covers || []).slice();
    if (p.secondary && c.indexOf(p.secondary) < 0) c.unshift(p.secondary);
    if (p.position && c.indexOf(p.position) < 0) c.unshift(p.position);
    return c;
  }
  function rank(p, code) {
    var r = (p.ranks || {})[code];
    return typeof r === 'number' ? r : 999;
  }
  function forSlot(code) {
    return players()
      .filter(function (p) { return covers(p).indexOf(code) >= 0; })
      .sort(function (a, b) {
        return rank(a, code) - rank(b, code) || (a.name || '').localeCompare(b.name || '');
      });
  }
  function reorder(code, list) {
    list.forEach(function (p, i) {
      var d = db();
      var r = Object.assign({}, d.players[p.id].ranks || {});
      r[code] = i;
      d.players[p.id].ranks = r;
      write(d);
    });
  }
  function move(code, id, dir) {
    var list = forSlot(code);
    var i = list.findIndex(function (p) { return p.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    reorder(code, list);
    draw();
  }

  /* ---------- formation ---------- */
  function renderFormation() {
    var host = document.getElementById('formation');
    host.innerHTML = '';
    SLOTS.forEach(function (sl) {
      var list = forSlot(sl.code);
      var card = el('div', {
        class: 'slot' + (list.length === 0 ? ' empty-slot' : (list.length < 2 ? ' thin' : '')),
        style: 'grid-row:' + sl.row + ';grid-column:' + sl.col
      });
      card.appendChild(el('div', { class: 'slot-hd' }, [
        el('b', { text: sl.code }),
        el('span', { style: 'font-size:12px;opacity:.85', text: sl.name }),
        el('i', { text: '#' + sl.nums })
      ]));

      if (!list.length) {
        card.appendChild(el('div', { class: 'none', text: 'Nobody covers this' }));
        host.appendChild(card);
        return;
      }

      var tbl = el('table');
      tbl.appendChild(el('thead', {}, [el('tr', {}, [
        el('th', { text: '#' }), el('th', { text: 'Player' }), el('th', { text: 'Qtr' }),
        el('th', { text: 'Age' }), el('th', { text: 'Covers' }), el('th', { text: '' })
      ])]));
      var body = el('tbody');
      list.forEach(function (p, i) {
        body.appendChild(el('tr', {}, [
          el('td', { class: 'rk', text: String(i + 1) }),
          el('td', { class: 'nm', text: (p.number ? p.number + ' ' : '') + (p.name || '-') }),
          el('td', { class: 'qb', text: p.qtr || qtrFromDOB(p.dob) || '-' }),
          el('td', { class: 'ag', text: (p.dob ? ageGroupOf(p.dob) : (p.ageGroup || '-')) }),
          el('td', { class: 'ps', text: covers(p).join(', ') }),
          el('td', {}, [el('div', { class: 'mv no-print' }, [
            el('button', { text: '\u2191', title: 'Up', onclick: function () { move(sl.code, p.id, -1); } }),
            el('button', { text: '\u2193', title: 'Down', onclick: function () { move(sl.code, p.id, 1); } })
          ])])
        ]));
      });
      tbl.appendChild(body);
      card.appendChild(tbl);
      host.appendChild(card);
    });
  }

  /* ---------- totals ---------- */
  function renderTotals() {
    var host = document.getElementById('totals');
    host.innerHTML = '';
    var list = players();
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty', text: 'No players on ' + S.planLabel(plan) + ' yet. Add them on the IDP page.' }));
      return;
    }
    var byQ = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, unset: 0 };
    var byAge = {};
    list.forEach(function (p) {
      var qq = p.qtr || qtrFromDOB(p.dob); byQ[qq] != null ? byQ[qq]++ : byQ.unset++;
      var a = p.dob ? ageGroupOf(p.dob) : (p.ageGroup || 'unset');
      byAge[a] = (byAge[a] || 0) + 1;
    });
    var thin = SLOTS.filter(function (s) { return forSlot(s.code).length < 2; });

    var st = el('div', { class: 'stats' });
    [[list.length, 'Players'], [byQ.Q1, 'Born Q1'], [byQ.Q2, 'Born Q2'],
     [byQ.Q3 + byQ.Q4, 'Born Q3 or Q4']].forEach(function (x) {
      st.appendChild(el('div', { class: 'stat' }, [el('b', { text: String(x[0]) }), el('span', { text: x[1] })]));
    });
    host.appendChild(st);

    var byBand = {};
    list.forEach(function (p) { if (p.dob) byBand[bandOf(p.dob)] = (byBand[bandOf(p.dob)] || 0) + 1; });
    var noDob = list.filter(function (p) { return !p.dob; }).length;
    host.appendChild(el('p', {
      class: 'hint', style: 'margin-top:12px',
      text: 'Birth years: ' + (Object.keys(byBand).sort().map(function (k) { return k + ' \u00d7' + byBand[k]; }).join(', ') || 'none set') +
        (noDob ? ' \u00b7 ' + noDob + ' with no date of birth' : '')
    }));
    host.appendChild(el('p', {
      class: 'hint', style: 'margin-top:4px',
      text: 'Age groups: ' + (Object.keys(byAge).sort().map(function (k) { return k + ' \u00d7' + byAge[k]; }).join(', ') || 'none') +
        ' \u00b7 season counted from 1 August'
    }));

    if (thin.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin-top:6px' }, [
        el('strong', { text: 'One deep or empty: ' }),
        el('span', { text: thin.map(function (s) { return s.code + ' (' + forSlot(s.code).length + ')'; }).join(', ') })
      ]));
    }
  }

  /* ---------- roster editor ---------- */
  function renderRoster() {
    var host = document.getElementById('rosterTable');
    host.innerHTML = '';
    var list = players().sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    host.className = 'grid-t fixed';
    var W = [50, 172, 128, 78, 92, 96, 84, 96, 96, 260];
    host.style.minWidth = W.reduce(function (a, b) { return a + b; }, 0) + 'px';
    var cg = el('colgroup');
    W.forEach(function (w) { cg.appendChild(el('col', { style: 'width:' + w + 'px' })); });
    host.appendChild(cg);
    host.appendChild(el('thead', {}, [el('tr', {},
      ['No.', 'Player', 'D.O.B.', 'Age', 'Birth year', 'Qtr. born', 'Age group', 'Primary', 'Secondary', 'Also covers']
        .map(function (h) { return el('th', { text: h }); }))]));

    if (!list.length) {
      host.appendChild(el('tbody', {}, [el('tr', {}, [el('td', { colspan: 10, class: 'prose' }, [
        el('div', { class: 'empty', style: 'margin:10px', text: 'Add players on the IDP page. They appear here automatically.' })
      ])])]));
      return;
    }

    var body = el('tbody');
    list.forEach(function (p) {
      var tr = el('tr');
      tr.appendChild(el('td', { text: p.number || '-', style: 'font-family:var(--mono)' }));
      tr.appendChild(el('td', { class: 'prose', text: p.name || '-' }));

      var dob = el('input', { type: 'date', value: p.dob || '' });
      dob.addEventListener('change', function () {
        set(p.id, { dob: dob.value, qtr: qtrFromDOB(dob.value),
          ageGroup: ageGroupOf(dob.value), band: bandOf(dob.value) });
        draw();
      });
      tr.appendChild(el('td', {}, [dob]));
      tr.appendChild(el('td', {}, [p.dob
        ? el('span', { style: 'font-family:var(--mono);font-size:12px', text: ageNow(p.dob) })
        : el('span', { class: 'chip off', text: '-' })]));
      tr.appendChild(el('td', {}, [p.dob
        ? el('span', { class: 'chip', text: bandOf(p.dob) })
        : el('span', { class: 'chip off', text: '-' })]));
      var q2 = p.qtr || qtrFromDOB(p.dob);
      tr.appendChild(el('td', {}, [q2
        ? el('span', { class: 'chip', text: q2 + ' ' + QTR_MONTHS[q2] })
        : el('span', { class: 'chip off', text: 'set a DOB' })]));

      tr.appendChild(el('td', {}, [p.dob
        ? el('span', { class: 'chip ao', title: 'From the date of birth, season starting 1 August',
            text: ageGroupOf(p.dob) })
        : el('span', { class: 'chip off', text: 'set a DOB' })]));

      [['position', 'primary'], ['secondary', 'secondary']].forEach(function (f) {
        tr.appendChild(el('td', {}, [p[f[0]]
          ? el('span', { class: 'chip' + (f[0] === 'secondary' ? ' at' : ''), text: p[f[0]] })
          : el('span', { class: 'chip off', text: '-' })]));
      });

      var box = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
      SLOTS.forEach(function (sl) {
        if (sl.code === p.position || sl.code === p.secondary) return;
        var cb = el('input', { type: 'checkbox' });
        cb.checked = (p.covers || []).indexOf(sl.code) >= 0;
        cb.addEventListener('change', function () {
          var c = (p.covers || []).slice();
          var i = c.indexOf(sl.code);
          if (cb.checked && i < 0) c.push(sl.code);
          if (!cb.checked && i >= 0) c.splice(i, 1);
          set(p.id, { covers: c });
          p.covers = c;
          draw();
        });
        box.appendChild(el('label', { style: 'display:flex;gap:4px;align-items:center;font-size:12px' },
          [cb, el('span', { text: sl.code })]));
      });
      tr.appendChild(el('td', {}, [box]));
      body.appendChild(tr);
    });
    host.appendChild(body);
  }

  /* ---------- export ---------- */
  function csv() {
    var rows = [['Position', 'Shirt numbers', 'Rank', 'Player', 'Number', 'D.O.B.', 'Age',
      'Birth year', 'Qtr. born', 'Age group', 'Covers']];
    SLOTS.forEach(function (sl) {
      var list = forSlot(sl.code);
      if (!list.length) { rows.push([sl.code, sl.nums, '', '(nobody)', '', '', '', '', '', '', '']); return; }
      list.forEach(function (p, i) {
        rows.push([sl.code, sl.nums, i + 1, p.name || '', p.number || '', p.dob || '', ageNow(p.dob),
          bandOf(p.dob), p.qtr || qtrFromDOB(p.dob), (p.dob ? ageGroupOf(p.dob) : p.ageGroup || ''), covers(p).join(' ')]);
      });
    });
    S.download('DepthChart_' + S.planLabel(plan).replace(/[^\w-]+/g, '_') + '.csv', S.toCSV(rows), 'text/csv');
  }

  function buildPrint() {
    var html = '<h1 style="margin:0 0 2pt;font-size:16pt">Depth chart · ' + esc(S.planLabel(plan)) + '</h1>' +
      '<p style="margin:0 0 10pt;font-size:9.5pt">Q1 Aug-Oct · Q2 Nov-Jan · Q3 Feb-Apr · Q4 May-Jul</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8pt">';
    SLOTS.forEach(function (sl) {
      var list = forSlot(sl.code);
      html += '<div style="break-inside:avoid;border:1px solid #143250">' +
        '<div style="background:#143250;color:#fff;padding:3pt 5pt;font-weight:600;font-size:10pt">' +
        esc(sl.code + ' ' + sl.name) + ' &nbsp;#' + esc(sl.nums) + '</div>';
      if (!list.length) html += '<p style="padding:5pt;margin:0;font-size:9pt;font-style:italic">Nobody covers this</p>';
      else {
        html += '<table style="width:100%;border-collapse:collapse;font-size:9pt">' +
          '<tr><th style="text-align:left;padding:2pt 4pt">Rank</th><th style="text-align:left;padding:2pt 4pt">Player</th>' +
          '<th style="text-align:left;padding:2pt 4pt">Qtr</th><th style="text-align:left;padding:2pt 4pt">Age</th>' +
          '<th style="text-align:left;padding:2pt 4pt">Positions</th></tr>';
        list.forEach(function (p, i) {
          html += '<tr><td style="padding:2pt 4pt;border-top:.5pt solid #ccc">' + (i + 1) + '</td>' +
            '<td style="padding:2pt 4pt;border-top:.5pt solid #ccc">' + esc(p.name || '') + '</td>' +
            '<td style="padding:2pt 4pt;border-top:.5pt solid #ccc">' + esc(p.qtr || qtrFromDOB(p.dob)) + '</td>' +
            '<td style="padding:2pt 4pt;border-top:.5pt solid #ccc">' + esc(p.ageGroup || '') + '</td>' +
            '<td style="padding:2pt 4pt;border-top:.5pt solid #ccc">' + esc(covers(p).join(', ')) + '</td></tr>';
        });
        html += '</table>';
      }
      html += '</div>';
    });
    html += '</div>';
    document.getElementById('printOnly').innerHTML = html;
    document.body.classList.add('has-printsheet');
  }

  function draw() { renderFormation(); renderTotals(); renderRoster(); }

  document.addEventListener('DOMContentLoaded', function () {
    var ps = document.getElementById('planSel');
    S.planList().forEach(function (p) { ps.appendChild(el('option', { value: p.id, text: p.short })); });
    ps.value = plan;
    ps.addEventListener('change', function () { plan = ps.value; S.setPref('squad', plan); draw(); });
    document.getElementById('btnCsv').addEventListener('click', csv);
    document.getElementById('btnPrint').addEventListener('click', function () { buildPrint(); window.print(); });
    window.addEventListener('beforeprint', buildPrint);
    draw();
  });
})();

/* ============================================================
   season.js — turns a plan config into a day-by-day calendar.
   Every plan runs through here, the two built-in squads included,
   so a blank plan behaves exactly like a populated one.

   config = {
     id, label,
     start:'2026-08-03', end:'2026-12-13',
     training: { '1':75, '2':90, '4':75 },   // 0 Sun .. 6 Sat -> minutes
     gameDuration: '2x35',
     blocks: [{name,start,end,purpose}],
     fixtures: [{date,ha,opp,venue,field,ko,comp,dur}]
   }
   ============================================================ */
(function (w) {
  'use strict';

  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var RPE_BY_GD = {
    'GD-1': 'Organizational 4-5 RPE', 'GD-2': 'Organizational 4-5 RPE',
    'GD-3': 'Threshold 7-8 RPE', 'GD-4': 'Threshold 7-8 RPE', 'GD-5': 'Maintenance 6-7 RPE',
    'GD+1': 'Recovery 2-3 RPE', 'GD+2': 'Organizational 4-5 RPE',
    'GD+3': 'Threshold 7-8 RPE', 'GD+4': 'Maintenance 6-7 RPE'
  };

  function toDate(iso) { return new Date(iso + 'T12:00:00'); }
  function toISO(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function diffDays(a, b) { return Math.round((b - a) / 86400000); }

  function blockFor(iso, blocks) {
    for (var i = 0; i < blocks.length; i++) {
      if (iso >= blocks[i].start && iso <= blocks[i].end) return blocks[i].name;
    }
    return '';
  }

  function build(cfg) {
    if (!cfg || !cfg.start || !cfg.end) return [];
    var fixtures = (cfg.fixtures || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var blocks = cfg.blocks || [];
    var training = cfg.training || {};

    var gameDates = [];
    fixtures.forEach(function (f) { if (gameDates.indexOf(f.date) < 0) gameDates.push(f.date); });
    gameDates.sort();

    var rows = [], d = toDate(cfg.start), endD = toDate(cfg.end), week = 1;

    while (d <= endD) {
      var iso = toISO(d), wd = d.getDay();
      var fx = fixtures.filter(function (f) { return f.date === iso; });

      var gd = '';
      if (fx.length) gd = 'Game';
      else {
        var prev = null, next = null, i;
        for (i = 0; i < gameDates.length; i++) {
          if (gameDates[i] < iso) prev = gameDates[i];
          if (gameDates[i] > iso && next === null) next = gameDates[i];
        }
        var a = prev ? diffDays(toDate(prev), d) : 999;
        var b = next ? diffDays(d, toDate(next)) : 999;
        if (b <= a && b < 999) gd = 'GD-' + b;
        else if (a < 999) gd = 'GD+' + a;
      }

      var row;
      if (fx.length) {
        var ha = fx[0].ha || '';
        var suffix = /away/i.test(ha) ? 'AWAY' : (/home/i.test(ha) ? 'HOME' : 'NEUTRAL');
        row = {
          date: iso, dow: DOW[wd], week: week, block: blockFor(iso, blocks),
          event: 'Game ' + suffix,
          duration: fx[0].dur || cfg.gameDuration || '2x45',
          gd: 'Game', rpe: 'Game 9-10 RPE',
          notes: fx.map(function (f) {
            return [f.ha, f.opp ? 'v ' + f.opp : '', f.ko].filter(Boolean).join(' ').trim();
          }).join(' + '),
          venue: fx[0].venue || '', field: fx[0].field || '', comp: fx[0].comp || '',
          opp: fx.map(function (f) { return f.opp; }).filter(Boolean).join(' / '),
          games: fx.length,
          /* each game kept whole, so two on a date can be told apart */
          fixtures: fx.map(function (f, gi) {
            return { i: gi, ha: f.ha || '', opp: f.opp || '', ko: f.ko || '',
              venue: f.venue || '', field: f.field || '', comp: f.comp || '', dur: f.dur || '' };
          })
        };
      } else if (training[String(wd)]) {
        var mins = training[String(wd)];
        row = {
          date: iso, dow: DOW[wd], week: week, block: blockFor(iso, blocks),
          event: 'Training Session', duration: mins + ' Minutes', mins: mins,
          gd: gd, rpe: RPE_BY_GD[gd] || 'Maintenance 6-7 RPE',
          notes: '', venue: '', field: '', comp: '', opp: '', games: 0
        };
      } else {
        row = {
          date: iso, dow: DOW[wd], week: week, block: blockFor(iso, blocks),
          event: 'OFF', duration: 'OFF', gd: gd, rpe: '',
          notes: '', venue: '', field: '', comp: '', opp: '', games: 0
        };
      }

      rows.push(row);
      if (wd === 0) week++;
      d = addDays(d, 1);
    }
    return rows;
  }

  /* ---------- fixture CSV ----------
     Reads the same column shape as NCFC_U13_U19_Fall_Schedule.csv.
     Dates may be '12-Sep', '2026-09-12' or '9/12/2026'. */
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }

  function normDate(raw, year) {
    raw = (raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    var m = /^(\d{1,2})[-\s]([A-Za-z]{3,})$/.exec(raw);
    if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return year + '-' + p(MONTHS[m[2].slice(0, 3).toLowerCase()]) + '-' + p(+m[1]);
    m = /^([A-Za-z]{3,})[-\s](\d{1,2})$/.exec(raw);
    if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return year + '-' + p(MONTHS[m[1].slice(0, 3).toLowerCase()]) + '-' + p(+m[2]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(raw);
    if (m) { var y = +m[3]; if (y < 100) y += 2000; return y + '-' + p(+m[1]) + '-' + p(+m[2]); }
    return '';
  }

  function fixturesFromCSV(text, opts) {
    opts = opts || {};
    var rows = parseCSV(text);
    if (!rows.length) return { fixtures: [], skipped: 0, teams: [] };
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var col = function () {
      for (var i = 0; i < arguments.length; i++) {
        var k = head.indexOf(arguments[i]);
        if (k >= 0) return k;
      }
      return -1;
    };
    var iDate = col('date'), iTeam = col('team', 'squad'), iHA = col('home/away', 'home / away', 'venue type'),
      iOpp = col('opponent', 'opposition'), iLoc = col('location', 'venue'), iField = col('field', 'pitch'),
      iKo = col('kickoff', 'ko', 'time'), iNotes = col('notes', 'competition', 'comp');
    if (iDate < 0) return { fixtures: [], skipped: rows.length - 1, teams: [] };

    var out = [], skipped = 0, teams = [];
    rows.slice(1).forEach(function (r) {
      var team = iTeam >= 0 ? (r[iTeam] || '').trim() : '';
      if (team && teams.indexOf(team) < 0) teams.push(team);
      if (opts.team && team && team.toLowerCase() !== opts.team.toLowerCase()) return;
      var date = normDate(r[iDate], opts.year || new Date().getFullYear());
      if (!date) { skipped++; return; }
      out.push({
        date: date,
        ha: iHA >= 0 ? (r[iHA] || '').trim() : '',
        opp: iOpp >= 0 ? (r[iOpp] || '').trim() : '',
        venue: iLoc >= 0 ? (r[iLoc] || '').replace(/\s+/g, ' ').trim() : '',
        field: iField >= 0 ? (r[iField] || '').trim() : '',
        ko: iKo >= 0 ? (r[iKo] || '').trim() : '',
        comp: iNotes >= 0 ? (r[iNotes] || '').trim() : ''
      });
    });
    return { fixtures: out, skipped: skipped, teams: teams };
  }

  w.SeasonGen = {
    build: build, fixturesFromCSV: fixturesFromCSV, parseCSV: parseCSV,
    normDate: normDate, RPE_BY_GD: RPE_BY_GD, DOW: DOW
  };
})(window);

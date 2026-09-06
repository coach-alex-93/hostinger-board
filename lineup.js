/* ============================================================
   lineup.js — team sheets, minutes, and what they mean for the week
   A team sheet belongs to a fixture. Once minutes are recorded, the
   training week can answer a different question for each player:
   who needs topping up, who needs managing.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.lineups.v1';

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(K, JSON.stringify(d)); return true; }
    catch (e) { if (w.Store) w.Store.toast('Could not save the team sheet.'); return false; }
  }
  /* Two games on one date are two team sheets. The first keeps the old key so
     nothing recorded before this change is lost. */
  function key(plan, date, gi) { return plan + '|' + date + (gi ? '#' + gi : ''); }

  function blank(plan, date, length, gi) {
    return { plan: plan, date: date, game: gi || 0, length: length || 80, formation: '',
      oppFormation: '', oppName: '',
      xi: [], subs: [], unavailable: [], note: '' };
  }
  function get(plan, date, gi) {
    var d = read()[key(plan, date, gi || 0)];
    return d ? JSON.parse(JSON.stringify(d)) : null;
  }
  function save(sheet) {
    var d = read();
    d[key(sheet.plan, sheet.date, sheet.game || 0)] = sheet;
    return write(d);
  }
  function remove(plan, date, gi) { var d = read(); delete d[key(plan, date, gi || 0)]; write(d); }
  function all(plan) {
    var d = read(), out = [];
    Object.keys(d).forEach(function (k) { if (!plan || d[k].plan === plan) out.push(d[k]); });
    return out.sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
  }

  /* minutes for one player in one sheet */
  function minutesIn(sheet, pid) {
    var m = 0;
    (sheet.xi || []).forEach(function (r) {
      if (r.playerId !== pid) return;
      var off = r.off === '' || r.off == null ? sheet.length : +r.off;
      m += Math.max(0, off - (+r.on || 0));
    });
    (sheet.subs || []).forEach(function (r) {
      if (r.playerId !== pid) return;
      if (r.on === '' || r.on == null) return;           // unused sub
      var off = r.off === '' || r.off == null ? sheet.length : +r.off;
      m += Math.max(0, off - (+r.on || 0));
    });
    return m;
  }
  function started(sheet, pid) {
    return (sheet.xi || []).some(function (r) { return r.playerId === pid; });
  }

  /* minutes across a window, with what was available to play */
  function window_(plan, from, to) {
    var sheets = all(plan).filter(function (s) {
      return (!from || s.date >= from) && (!to || s.date <= to);
    });
    var avail = sheets.reduce(function (a, s) { return a + (+s.length || 0); }, 0);
    var byPlayer = {};
    sheets.forEach(function (s) {
      var seen = {};
      (s.xi || []).concat(s.subs || []).forEach(function (r) {
        if (!r.playerId || seen[r.playerId]) return;
        seen[r.playerId] = 1;
        var m = minutesIn(s, r.playerId);
        byPlayer[r.playerId] = byPlayer[r.playerId] || { mins: 0, apps: 0, starts: 0 };
        byPlayer[r.playerId].mins += m;
        if (m > 0) byPlayer[r.playerId].apps++;
        if (started(s, r.playerId)) byPlayer[r.playerId].starts++;
      });
    });
    return { sheets: sheets, available: avail, byPlayer: byPlayer };
  }

  /* What the week should do for a player, given what the weekend did.
     The thresholds are a starting point, not a rule; they are stated so they
     can be argued with rather than hidden in a colour. */
  /* Banded on minutes actually played, not on a share of what was available.
     Seventy per cent of a two-game week is far more work than seventy per cent
     of a one-game week, so the share was measuring the wrong thing.
     These are minutes across the last seven days. Edit them if you disagree. */
  /* Banded on minutes played, not a share of what was available: seventy per
     cent of a two-game week is far more work than seventy per cent of a
     one-game week. The thresholds scale with how long that team's games are,
     because half a game means 40 minutes at U13 and 45 at U19. Both can be
     overridden per plan. */
  function gameLength(plan) {
    var cfg = (w.Store && w.Store.planConfig) ? (w.Store.planConfig(plan) || {}) : {};
    if (cfg.gameLength) return +cfg.gameLength;
    var sheets = all(plan);
    if (sheets.length) return +sheets[sheets.length - 1].length || 80;
    return 80;
  }
  function bandsFor(plan) {
    var cfg = (w.Store && w.Store.planConfig) ? (w.Store.planConfig(plan) || {}) : {};
    var len = gameLength(plan);
    var low = cfg.loadLow != null ? +cfg.loadLow : Math.round(len * 0.375);
    var high = cfg.loadHigh != null ? +cfg.loadHigh : Math.round(len * 1.5);
    return [
      { max: low, key: 'top-up', cls: 'at', label: 'Needs volume',
        advice: 'Under ' + low + ' minutes in seven days, about half a game. Give extra work: longer intervals, a second group, or a small-sided block after the session.' },
      { max: high, key: 'normal', cls: 'ao', label: 'Normal week',
        advice: 'Between ' + low + ' and ' + high + ' minutes, half a game to roughly a game and a half. Train the week as planned.' },
      { max: 1e9, key: 'manage', cls: 'dt', label: 'Manage the load',
        advice: 'Over ' + high + ' minutes, more than a game and a half. Ease the first session after the game, and watch readiness before the threshold day.' }
    ];
  }
  var BANDS = bandsFor('');
  function bandFor(mins, plan) {
    if (mins == null) return null;
    var bands = plan ? bandsFor(plan) : BANDS;
    for (var i = 0; i < bands.length; i++) if (mins <= bands[i].max) return bands[i];
    return bands[bands.length - 1];
  }

  /* one entry per game, not per date, so a double-header lists twice */
  function fixtures(plan) {
    if (!w.Store) return [];
    var out = [];
    w.Store.planRows(plan).filter(function (r) { return (r.games || 0) > 0; })
      .forEach(function (r) {
        var list = r.fixtures && r.fixtures.length ? r.fixtures : [{ i: 0, ha: r.ha || '', opp: r.opp || '', ko: r.ko || '' }];
        list.forEach(function (f) {
          out.push({ date: r.date, game: f.i, of: list.length, row: r,
            ha: f.ha, opp: f.opp, ko: f.ko, venue: f.venue || r.venue,
            field: f.field || r.field, comp: f.comp || r.comp, dur: f.dur });
        });
      });
    return out;
  }
  function fixtureAt(plan, date, gi) {
    return fixtures(plan).filter(function (f) {
      return f.date === date && f.game === (gi || 0);
    })[0] || null;
  }

  /* place a formation on the board: rows back to front, evenly spread */
  function shapeRows(shape) {
    var parts = String(shape || '').split(/[^0-9]+/).filter(Boolean).map(Number);
    if (!parts.length) return null;
    if (parts[0] !== 1) parts.unshift(1);              // the keeper
    return parts;
  }
  function positions(shape, W, H, flip) {
    var rows = shapeRows(shape);
    if (!rows) return [];
    var out = [], n = rows.length;
    /* Our own shape defends the bottom goal and attacks upward. The opposition
       is the same shape read the other way, so it comes down the pitch. */
    var near = flip ? H * 0.08 : H * 0.92;
    var far = flip ? H * 0.90 : H * 0.10;
    rows.forEach(function (count, ri) {
      var y = near + (far - near) * (ri / Math.max(1, n - 1));
      for (var i = 0; i < count; i++) {
        var x = W * (i + 1) / (count + 1);
        out.push({ x: Math.round(x), y: Math.round(y), row: ri });
      }
    });
    return out;
  }

  function roster(plan) {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    return Object.keys(d.players || {}).map(function (k) { return d.players[k]; })
      .filter(function (p) { return p.plan === plan; })
      .sort(function (a, b) { return (+a.number || 99) - (+b.number || 99) || (a.name || '').localeCompare(b.name || ''); });
  }

  /* every player on the plan, with what they have actually played */
  function seasonMinutes(plan) {
    var wnd = window_(plan);
    return roster(plan).map(function (p) {
      var r = wnd.byPlayer[p.id] || { mins: 0, apps: 0, starts: 0 };
      return { player: p, played: r.mins, apps: r.apps, starts: r.starts,
        share: wnd.available ? r.mins / wnd.available : null };
    }).sort(function (a, b) { return b.played - a.played; });
  }

  /* What the last seven days asks of the week that follows. A window rather
     than a game count, so a weekend double-header and a midweek fixture both
     land in the same total. */
  function daysBefore(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function weekLoad(plan, beforeDate, days) {
    var span = days || 7;
    var from = beforeDate ? daysBefore(beforeDate, span) : '';
    var recent = all(plan).filter(function (s2) {
      return (!beforeDate || s2.date < beforeDate) && (!from || s2.date >= from);
    });
    if (!recent.length) return [];
    var avail = recent.reduce(function (a, s2) { return a + (+s2.length || 0); }, 0);
    return roster(plan).map(function (p) {
      var m = recent.reduce(function (a, s2) { return a + minutesIn(s2, p.id); }, 0);
      var share = avail ? m / avail : null;
      return { player: p, mins: { played: m, available: avail }, share: share,
        games: recent.length, from: from, band: bandFor(m, plan) };
    }).sort(function (a, b) { return b.mins.played - a.mins.played; });
  }

  /* a board state drawn straight from a shape string, so a formation shows
     itself without anyone drawing it */
  function diagram(shape, names, opts) {
    opts = opts || {};
    var pts = positions(shape, 620, 600, opts.flip);
    if (!pts.length) return null;
    var col = opts.color || 'blue';
    var side = opts.side || (opts.flip ? 'them' : 'us');
    /* every placed piece is tagged with the side it belongs to, so putting a
       shape out again replaces that team and leaves the other one alone */
    var objs = pts.map(function (pt, n) {
      return { type: n === 0 ? 'cir' : 'tri', color: col, x: pt.x, y: pt.y, side: side,
        deg: opts.flip ? 180 : 0, dir: opts.flip ? 4 : 0, n: opts.numbers === false ? '' : String(n + 1) };
    });
    (names || []).forEach(function (nm, n) {
      if (!nm || !pts[n]) return;
      objs.push({ type: 'text', color: 'white', x: pts[n].x, y: pts[n].y + 24, t: nm, side: side });
    });
    return { field: 'full', scale: 0.8, objects: objs };
  }

  /* remove only the pieces belonging to one side */
  function clearSide(board, side) {
    var before = board.state.objects.length;
    board.state.objects = board.state.objects.filter(function (o) { return o.side !== side; });
    board.sel = -1;
    return before - board.state.objects.length;
  }

  w.Lineup = { get: get, save: save, diagram: diagram, clearSide: clearSide, remove: remove, all: all, blank: blank,
    minutesIn: minutesIn, started: started, window: window_, fixtureAt: fixtureAt, key: key,
    seasonMinutes: seasonMinutes, weekLoad: weekLoad, roster: roster, bandFor: bandFor,
    daysBefore: daysBefore,
    BANDS: BANDS, bandsFor: bandsFor, gameLength: gameLength, fixtures: fixtures, positions: positions, shapeRows: shapeRows, KEY: K };
})(window);

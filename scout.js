/* ============================================================
   scout.js — counting a whole game, and what it becomes
   One tap per event while the video runs. Enough games at a level
   and the counts stop being an impression and start being a
   benchmark you can set a target against.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.scout.v1';

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(K, JSON.stringify(d)); return true; }
    catch (e) { if (w.Store) w.Store.toast('Could not save. Storage may be full.'); return false; }
  }

  function blank() {
    return {
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      date: w.Store ? w.Store.todayISO() : '',
      teamA: '', teamB: '', level: '', competition: '', video: '', length: 80,
      watching: 'A', note: '', events: []
    };
  }
  function all() {
    var d = read();
    return Object.keys(d).map(function (k) { return d[k]; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  }
  function get(id) { var r = read()[id]; return r ? JSON.parse(JSON.stringify(r)) : null; }
  function save(rec) { var d = read(); d[rec.id] = rec; return write(d); }
  function remove(id) { var d = read(); delete d[id]; write(d); }

  /* ---------- one game ---------- */
  function tally(rec, team) {
    var out = {};
    (rec.events || []).forEach(function (e) {
      if (team && e.team !== team) return;
      var t = out[e.type] = out[e.type] || { n: 0, ok: 0 };
      t.n++;
      if (e.ok) t.ok++;
    });
    return out;
  }
  function per90(n, length) {
    var len = +length || 80;
    return len ? n / len * 90 : 0;
  }
  function summary(rec, team) {
    var t = tally(rec, team);
    return Object.keys(t).map(function (type) {
      return { type: type, n: t[type].n, ok: t[type].ok,
        rate: t[type].n ? t[type].ok / t[type].n : null,
        per90: per90(t[type].n, rec.length) };
    }).sort(function (a, b) { return b.n - a.n; });
  }

  /* ---------- across games at a level ----------
     A benchmark is a mean with a count of games behind it. The count is shown
     because three games is a hint and ten is a finding. */
  function levels() {
    var out = {};
    all().forEach(function (r) { if (r.level) out[r.level] = (out[r.level] || 0) + 1; });
    return out;
  }
  function benchmark(level, team) {
    var games = all().filter(function (r) { return !level || r.level === level; });
    var agg = {};
    games.forEach(function (r) {
      var s = summary(r, team || null);
      s.forEach(function (x) {
        var a = agg[x.type] = agg[x.type] || { games: 0, n: 0, ok: 0, per90: 0 };
        a.games++; a.n += x.n; a.ok += x.ok; a.per90 += x.per90;
      });
    });
    return Object.keys(agg).map(function (type) {
      var a = agg[type];
      return { type: type, games: a.games, total: a.n,
        per90: a.per90 / a.games,
        rate: a.n ? a.ok / a.n : null,
        confident: a.games >= 5 };
    }).sort(function (a, b) { return b.per90 - a.per90; });
  }

  /* the action set is the same one the tactics board classifies with */
  function actionTypes() {
    return ((w.CLUB && w.CLUB.actions) || []).map(function (a) { return a.type; });
  }
  function successWords(type) {
    var a = ((w.CLUB && w.CLUB.actions) || []).filter(function (x) { return x.type === type; })[0];
    return a ? a.success : [];
  }

  w.Scout = { all: all, get: get, save: save, remove: remove, blank: blank,
    tally: tally, summary: summary, per90: per90, levels: levels, benchmark: benchmark,
    actionTypes: actionTypes, successWords: successWords, KEY: K };
})(window);

/* ============================================================
   library.js — the saved activities, on their own
   The same store the planner writes to. Kept here so the library
   can be read, grouped and tidied without opening a session.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.activities.v1';

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(K, JSON.stringify(d)); return true; }
    catch (e) { if (w.Store) w.Store.toast('Could not save. Storage may be full.'); return false; }
  }
  function all() {
    var d = read();
    return Object.keys(d).map(function (k) { return d[k]; })
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }
  function get(id) { var r = read()[id]; return r ? JSON.parse(JSON.stringify(r)) : null; }
  function save(entry) { var d = read(); d[entry.id] = entry; return write(d); }
  function remove(id) { var d = read(); delete d[id]; write(d); }

  function themes() {
    return (w.Lists ? w.Lists.get('themes') : null) || (w.CLUB && w.CLUB.themes) || [];
  }

  /* One activity serves several topics. Playing out from the back is the same
     shape as pressing from the front, read from the other side, so a theme is a
     list rather than a single choice. Older entries with one theme, or none,
     still resolve to something. */
  function themesOf(x) {
    if (Array.isArray(x.themes) && x.themes.length) return x.themes;
    if (x.theme) return [x.theme];
    if (x.moment) return [x.moment];
    return ['Not yet themed'];
  }
  function byTheme() {
    var out = {};
    all().forEach(function (x) {
      themesOf(x).forEach(function (t) { (out[t] = out[t] || []).push(x); });
    });
    return out;
  }
  function hasTheme(x, t) { return themesOf(x).indexOf(t) >= 0; }
  function counts() {
    var b = byTheme(), out = {};
    Object.keys(b).forEach(function (k) { out[k] = b[k].length; });
    return out;
  }

  w.Library = { all: all, get: get, save: save, remove: remove,
    themes: themes, themesOf: themesOf, hasTheme: hasTheme, byTheme: byTheme, counts: counts, KEY: K };
})(window);

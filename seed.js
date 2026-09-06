/* ============================================================
   seed.js — one build, two audiences
   The app ships as a skeleton. If a seed file sits next to it and
   this browser is empty, the seed is loaded once. Your deploy
   carries the seed; the copy you hand to another coach does not.
   ============================================================ */
(function (w) {
  'use strict';
  var MARK = 'ncfc.seeded.v1';

  function isEmpty() {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('ncfc.') === 0 && k !== MARK) return false;
    }
    return true;
  }

  function apply(j, quiet) {
    var store = j && j.store;
    if (!store) return 0;
    var n = 0;
    Object.keys(store).forEach(function (k) {
      try { localStorage.setItem(k, store[k]); n++; } catch (e) {}
    });
    try { localStorage.setItem(MARK, JSON.stringify({ at: new Date().toISOString(), keys: n, name: j.name || '' })); } catch (e) {}
    if (!quiet && w.Store) w.Store.toast((j.name || 'Starting data') + ' loaded: ' + n + ' stores.');
    return n;
  }

  /* Only on a browser that has never been used. Anything already here is
     someone's work and is never overwritten without them asking. */
  function autoload(cb) {
    if (!isEmpty()) { if (cb) cb(false); return; }
    if (typeof fetch !== 'function') { if (cb) cb(false); return; }
    fetch('seed.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) { if (cb) cb(false); return; }
        var n = apply(j, true);
        if (n && cb) cb(true, j, n);
        else if (cb) cb(false);
      })
      .catch(function () { if (cb) cb(false); });
  }

  function seededInfo() {
    try { return JSON.parse(localStorage.getItem(MARK) || 'null'); } catch (e) { return null; }
  }

  w.Seed = { autoload: autoload, apply: apply, isEmpty: isEmpty, info: seededInfo, MARK: MARK };
})(window);

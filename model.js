/* ============================================================
   model.js — the game model as data
   Principles used to be baked into a file. They are now a list you
   edit: add, rename, re-code, move between moments, delete. What
   ships is the starting point, and Reset returns to it.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.model.v1';
  var MOMENTS = ['Attacking Organization', 'Defensive Organization', 'Attacking Transition', 'Defensive Transition'];
  var PHASES = {
    'Attacking Organization': ['Building', 'Attacking', 'Finishing'],
    'Defensive Organization': ['Impeding', 'Recovering', 'Protecting'],
    'Attacking Transition': ['Gaining Possession - Counter Attack', 'Gaining Possession - Secure Reorganize'],
    'Defensive Transition': ['Losing Possession - Counter-Press', 'Losing Possession - Reorganize']
  };

  function read() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
  function write(l) {
    try { localStorage.setItem(K, JSON.stringify(l)); w.PRINCIPLES = l; return true; }
    catch (e) { if (w.Store) w.Store.toast('Could not save the model.'); return false; }
  }
  function shipped() { return JSON.parse(JSON.stringify(w.SHIPPED_PRINCIPLES || [])); }
  function all() { return read() || shipped(); }
  function isEdited() { return !!read(); }

  function blank() {
    return { code: '', clubCode: '', name: '', clubName: '', teaching: '', cue: '',
      type: 'Foundational', moment: MOMENTS[0], phases: PHASES[MOMENTS[0]].slice(),
      subs: [], solutions: [] };
  }
  function upsert(p) {
    var l = all();
    var i = l.findIndex(function (x) { return x.code === p.code; });
    if (i < 0) l.push(p); else l[i] = p;
    return write(l) ? p : null;
  }
  function remove(code) {
    var l = all().filter(function (x) { return x.code !== code; });
    return write(l);
  }
  function move(code, dir) {
    var l = all();
    var i = l.findIndex(function (x) { return x.code === code; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= l.length) return false;
    l.splice(j, 0, l.splice(i, 1)[0]);
    return write(l);
  }
  function reset() {
    try { localStorage.removeItem(K); } catch (e) {}
    w.PRINCIPLES = shipped();
  }
  function codeFree(code, except) {
    return !all().some(function (x) { return x.code === code && x.code !== except; });
  }

  /* whatever is stored wins, before any page reads PRINCIPLES */
  if (!w.SHIPPED_PRINCIPLES) w.SHIPPED_PRINCIPLES = JSON.parse(JSON.stringify(w.PRINCIPLES || []));
  var stored = read();
  if (stored && stored.length) w.PRINCIPLES = stored;

  w.Model = { all: all, shipped: shipped, isEdited: isEdited, blank: blank, upsert: upsert,
    remove: remove, move: move, reset: reset, write: write, codeFree: codeFree,
    MOMENTS: MOMENTS, PHASES: PHASES, KEY: K };
})(window);

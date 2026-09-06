/* ============================================================
   autosave.js — nothing is lost by navigating
   A page registers a save function and a dirty test. From then on
   the work is written when you leave the page, when the tab hides,
   when the phone sleeps, and on a timer while you are still typing.
   ============================================================ */
(function (w) {
  'use strict';
  var reg = null, timer = null, EVERY = 20000, lastSaved = 0;

  function stamp(txt) {
    var n = document.getElementById('saveState');
    if (n) n.textContent = txt;
  }

  function saveNow(why) {
    if (!reg || !reg.isDirty()) return false;
    try {
      reg.save();
      lastSaved = Date.now();
      stamp('Saved ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) +
        (why === 'auto' ? ' \u00b7 auto' : ''));
      return true;
    } catch (e) {
      stamp('Could not save');
      return false;
    }
  }

  function register(opts) {
    reg = opts;                       // { save, isDirty }
    if (timer) clearInterval(timer);
    timer = setInterval(function () { saveNow('auto'); }, opts.every || EVERY);

    /* leaving the page in any of its forms */
    w.addEventListener('pagehide', function () { saveNow('leave'); });
    w.addEventListener('beforeunload', function () { saveNow('leave'); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveNow('hide');
    });

    /* any internal link: save before the browser moves */
    document.addEventListener('pointerdown', onLeaveLink, true);
    document.addEventListener('click', onLeaveLink, true);
    function onLeaveLink(e) {
      var t = e.target;
      var a = (t && t.closest) ? t.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (/^(#|mailto:|tel:|https?:)/.test(href) && href.indexOf(location.origin) !== 0) return;
      if (a.target === '_blank') return;
      saveNow('link');
    }

    /* and any form control losing focus, which is when a value is final */
    document.addEventListener('focusout', function () {
      if (!reg || !reg.isDirty()) return;
      if (Date.now() - lastSaved < 2500) return;
      saveNow('auto');
    }, true);
  }

  w.Autosave = { register: register, saveNow: saveNow, stamp: stamp };
})(window);

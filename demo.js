/* ============================================================
   demo.js — a worked session anyone can open and poke at
   Loads a small, obviously fictional dataset into a namespace of
   its own, marks the browser as being in demo mode, and offers to
   clear it. It never touches anything a real user has entered.
   ============================================================ */
(function (w) {
  'use strict';
  var FLAG = 'ncfc.demo.v1';

  function on() { return !!localStorage.getItem(FLAG); }

  function dataset() {
    var today = new Date(), iso = function (d) { return d.toISOString().slice(0, 10); };
    var d1 = new Date(today); d1.setDate(d1.getDate() - 2);
    var plan = 'demo';
    return {
      /* lastSession so the planner opens the worked one rather than a blank */
      'ncfc.prefs.v1': JSON.stringify({ coach: 'Demo coach', squad: plan, initials: 'SB', lastSession: 'demo1' }),
      'ncfc.plans.v1': JSON.stringify({
        demo: { id: plan, label: 'Demo squad, this season', short: 'Demo',
          start: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
          end: iso(new Date(today.getFullYear(), today.getMonth() + 3, 28)),
          days: { Mon: 75, Tue: 75, Thu: 75 }, gameDuration: '2x35', gameLength: 70,
          blocks: [{ name: 'Demo block', start: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
            end: iso(new Date(today.getFullYear(), today.getMonth() + 3, 28)), purpose: 'Show how it fits together' }],
          fixtures: [], builtin: false }
      }),
      'ncfc.sessions.v1': JSON.stringify({
        demo1: {
          id: 'demo1', date: iso(d1), squad: plan, coach: 'Demo coach', duration: 75,
          location: 'Demo pitch', method: 'Whole - Part - Whole',
          moment: 'Attacking Organization', phase: 'Building', principleCode: 'IP6',
          cycleObj: 'Break the last line more often', level: 'Refining',
          igs: 'When we have chances to break the last line we do not deliver the final pass, because nobody runs.',
          strategy: 'Penetrate behind the opposition backline.',
          learningPlan: 'Show the picture, then let them find it.',
          instanceName: 'The through ball behind the backline',
          components: [
            { text: 'The ball carrier has opportunity to play forward.', filter: 'Carrier central or in the half-space', missing: 'Overload away from the ball' },
            { text: 'Space is behind the backline for a through ball.', filter: 'Backline on or above halfway', missing: 'Constrain them to hold a higher line' },
            { text: 'A teammate is ahead of the ball to run onto it.', filter: 'Runner level with the last defender', missing: 'Call the run until they see it' }
          ],
          shapeIn: '3-2-5', shapeOut: '4-4-2',
          intentIn: 'Fix the back line, then release behind it.',
          intentOut: 'Protect the centre when it travels wide.',
          pa: ['Adjust body to see field and next action'],
          keyPlayers: [{ num: '9', pos: 'CF', name: '', why: 'the run that makes the pass possible' }],
          acts: [], boardStates: {}, ready: {}, kpis: [], status: 'draft'
        }
      })
    };
  }

  /* Anything under the app prefix that is not the demo's own flag is somebody's
     work. The demo refuses rather than replacing it. */
  function hasWork() {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('ncfc.') === 0 && k !== FLAG) return true;
    }
    return false;
  }

  function start(then) {
    if (hasWork() && !on()) {
      alert('There is already work in this browser.\n\nThe demo would replace your plans and settings, ' +
        'so it will not run here. Open it in a private window instead.');
      return false;
    }
    var d = dataset();
    Object.keys(d).forEach(function (k) {
      try { localStorage.setItem(k, d[k]); } catch (e) {}
    });
    try { localStorage.setItem(FLAG, JSON.stringify({ at: new Date().toISOString() })); } catch (e) {}
    if (then) then();
    return true;
  }

  function clear(then) {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && k.indexOf('ncfc.') === 0) localStorage.removeItem(k);
    }
    if (then) then();
  }

  /* a bar on every page while the demo is running, so nobody mistakes it
     for their own work */
  function banner() {
    if (!on() || document.getElementById('demoBar')) return;
    var main = document.querySelector('main');
    if (!main) return;
    var bar = document.createElement('div');
    bar.id = 'demoBar';
    bar.className = 'demobar no-print';
    var t = document.createElement('span');
    t.innerHTML = '<strong>Demo.</strong> A made-up squad and one worked session, so you can see how it ' +
      'fits together. Change anything you like; none of it is real and none of it is kept.';
    bar.appendChild(t);
    var b = document.createElement('button');
    b.className = 'btn ghost sm';
    b.textContent = 'Clear the demo';
    b.addEventListener('click', function () {
      if (!confirm('Clear the demo and start empty?')) return;
      clear(function () { location.href = 'hub.html'; });
    });
    bar.appendChild(b);
    main.insertBefore(bar, main.firstChild);
  }

  w.Demo = { on: on, start: start, clear: clear, banner: banner, hasWork: hasWork, FLAG: FLAG };
  document.addEventListener('DOMContentLoaded', banner);
})(window);

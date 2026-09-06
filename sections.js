/* ============================================================
   sections.js — hide the parts of a page you do not use
   Any card with a heading gets a small control to tidy it away.
   The choice is per page and permanent, and a bar at the top says
   how many are hidden so nothing disappears without a trace.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.sections.v1';

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} }
  function page() { return location.pathname.split('/').pop() || 'hub.html'; }
  function hidden() { return read()[page()] || []; }
  function setHidden(list) { var d = read(); d[page()] = list; write(d); }

  function idOf(card, i) {
    var h = card.querySelector('.card-hd h2');
    return (h ? h.textContent.trim().slice(0, 40) : 'section ' + i);
  }

  function apply() {
    var cards = [].slice.call(document.querySelectorAll('main .card'));
    var h = hidden(), n = 0;
    cards.forEach(function (card, i) {
      var id = idOf(card, i);
      var head = card.querySelector('.card-hd');
      if (!head) return;
      var off = h.indexOf(id) >= 0;
      card.style.display = off ? 'none' : '';
      if (off) n++;
      if (head.querySelector('.sechide')) return;
      var b = document.createElement('button');
      b.className = 'sechide no-print';
      b.type = 'button';
      b.title = 'Hide this section';
      b.textContent = '\u2715';
      b.addEventListener('click', function () {
        var cur = hidden();
        if (cur.indexOf(id) < 0) cur.push(id);
        setHidden(cur);
        apply();
      });
      head.appendChild(b);
    });
    banner(n);
  }

  function banner(n) {
    var main = document.querySelector('main');
    if (!main) return;
    var bar = document.getElementById('secBar');
    if (!n) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'secBar';
      bar.className = 'secbar no-print';
      main.insertBefore(bar, main.firstChild);
    }
    bar.innerHTML = '';
    var txt = document.createElement('span');
    txt.textContent = n + ' section' + (n === 1 ? '' : 's') + ' hidden on this page';
    bar.appendChild(txt);
    var a = document.createElement('button');
    a.className = 'btn ghost sm';
    a.textContent = 'Show them';
    a.addEventListener('click', function () { setHidden([]); apply(); });
    bar.appendChild(a);
  }

  w.Sections = { apply: apply, hidden: hidden, reset: function () { setHidden([]); apply(); } };
  document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 0); });
})(window);

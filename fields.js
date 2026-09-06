/* ============================================================
   fields.js — remove any field you do not use
   Sections can already be hidden. This is the same idea one level
   down: every labelled field carries a cross. Hiding is per page
   and permanent, and a bar reports the count so nothing is lost
   silently. Hidden fields keep whatever was typed in them.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.fields.v1';

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} }
  function page() { return location.pathname.split('/').pop() || 'hub.html'; }
  function hidden() { return read()[page()] || []; }
  function setHidden(l) { var d = read(); d[page()] = l; write(d); }

  function keyOf(node) {
    var c = node.querySelector('input,select,textarea');
    if (c && c.id) return c.id;
    var s = node.querySelector('span');
    return s ? 'lbl:' + s.textContent.trim().slice(0, 40) : '';
  }

  function apply() {
    var h = hidden(), n = 0;
    var nodes = [].slice.call(document.querySelectorAll('main label.f, main .fieldblock'));
    nodes.forEach(function (node) {
      var k = keyOf(node);
      if (!k) return;
      var off = h.indexOf(k) >= 0;
      node.style.display = off ? 'none' : '';
      if (off) { n++; return; }
      if (node.querySelector(':scope > .fldhide')) return;
      var b = document.createElement('button');
      b.className = 'fldhide no-print';
      b.type = 'button';
      b.title = 'Remove this field from the form';
      b.textContent = '\u2715';
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var cur = hidden();
        if (cur.indexOf(k) < 0) cur.push(k);
        setHidden(cur);
        apply();
      });
      node.appendChild(b);
      node.classList.add('hideable');
    });
    bar(n);
  }

  function bar(n) {
    var host = document.querySelector('main');
    if (!host) return;
    var el = document.getElementById('fldBar');
    if (!n) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'fldBar';
      el.className = 'secbar no-print';
      var after = document.getElementById('secBar');
      if (after && after.nextSibling) host.insertBefore(el, after.nextSibling);
      else host.insertBefore(el, host.firstChild);
    }
    el.innerHTML = '';
    var t = document.createElement('span');
    t.textContent = n + ' field' + (n === 1 ? '' : 's') + ' removed from this form';
    el.appendChild(t);
    var b = document.createElement('button');
    b.className = 'btn ghost sm';
    b.textContent = 'Put them back';
    b.addEventListener('click', function () { setHidden([]); apply(); });
    el.appendChild(b);
  }

  w.Fields = { apply: apply, hidden: hidden, reset: function () { setHidden([]); apply(); } };
  document.addEventListener('DOMContentLoaded', function () { setTimeout(apply, 30); });
})(window);

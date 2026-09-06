/* library-page.js — reading and tidying the saved activities */
(function () {
  'use strict';
  var S = window.Store, L = window.Library, el = S.el, esc = S.esc;
  var view = '', q = '';

  function meta() {
    var n = L.all().length;
    var multi = L.all().filter(function (x) { return L.themesOf(x).length > 1; }).length;
    document.getElementById('libMeta').textContent =
      n + ' saved' + (multi ? ' \u00b7 ' + multi + ' under more than one theme' : '');
  }

  function renderThemes() {
    var host = document.getElementById('themes');
    host.innerHTML = '';
    var c = L.counts();
    var keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
    if (!keys.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'Nothing saved yet. On any activity in the ' }),
        el('a', { href: 'planner.html', text: 'session planner' }),
        el('span', { text: ', press Save to library.' })
      ]));
      return;
    }
    var wrap = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
    wrap.appendChild(el('button', {
      class: 'btn ' + (view ? 'ghost' : 'turf') + ' sm', text: 'Everything (' + L.all().length + ')',
      onclick: function () { view = ''; draw(); }
    }));
    keys.forEach(function (k) {
      wrap.appendChild(el('button', {
        class: 'btn ' + (view === k ? 'turf' : 'ghost') + ' sm',
        text: k + ' (' + c[k] + ')',
        onclick: function () { view = view === k ? '' : k; draw(); }
      }));
    });
    host.appendChild(wrap);
    var sel = document.getElementById('themeSel');
    if (!sel.options.length) {
      sel.appendChild(el('option', { value: '', text: 'Every theme' }));
      L.themes().forEach(function (t) { sel.appendChild(el('option', { value: t, text: t })); });
    }
    sel.value = view;
  }

  var open = {};

  /* A line each. The library is a shelf you scan, not a document you read;
     the detail is one tap away when you want it. */
  function card(x) {
    var a = x.act;
    var box = el('div', { class: 'libcard' + (open[x.id] ? ' on' : '') });

    var head = el('div', { class: 'libhd' });
    head.appendChild(el('button', {
      class: 'libname', type: 'button',
      title: open[x.id] ? 'Hide the detail' : 'Show the detail',
      text: (open[x.id] ? '\u2212  ' : '+  ') + (x.name || 'untitled'),
      onclick: function () { open[x.id] = !open[x.id]; draw(); }
    }));
    var brief = [a.numbers, a.areaSize,
      a.intervals && (a.intervals + '\u00d7' + a.time), a.type].filter(Boolean).join('  \u00b7  ');
    head.appendChild(el('span', { class: 'hint libbrief', text: brief }));
    if (x.board) head.appendChild(el('span', { class: 'chip', text: 'diagram' }));
    head.appendChild(el('span', { class: 'sp' }));
    L.themesOf(x).forEach(function (t) {
      head.appendChild(el('span', { class: 'chip ' + (view && t === view ? 'ao' : ''), text: t }));
    });
    box.appendChild(head);

    if (!open[x.id]) return box;

    var bd = el('div', { class: 'libbd' });

    /* the themes it serves, ticked */
    bd.appendChild(el('span', { class: 'eyebrow', text: 'What it can be used for' }));
    var thBox = el('div', { class: 'subs', style: 'max-height:170px;margin:4px 0 10px' });
    L.themes().forEach(function (t) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = L.hasTheme(x, t);
      cb.addEventListener('change', function () {
        var cur = (Array.isArray(x.themes) && x.themes.length) ? x.themes.slice() : L.themesOf(x).slice();
        if (cur[0] === 'Not yet themed') cur = [];
        var i = cur.indexOf(t);
        if (cb.checked && i < 0) cur.push(t);
        if (!cb.checked && i >= 0) cur.splice(i, 1);
        x.themes = cur;
        delete x.theme;
        L.save(x); draw();
      });
      thBox.appendChild(el('label', {}, [cb, el('span', { text: t })]));
    });
    bd.appendChild(thBox);
    bd.appendChild(el('p', { class: 'hint', style: 'margin:0 0 10px',
      text: 'Tick every topic it works for. Playing out from the back is the same activity as pressing from the front, read from the other side.' }));

    var name = el('input', { type: 'text', value: x.name || '' });
    name.addEventListener('change', function () { x.name = name.value.trim(); L.save(x); draw(); });
    var tags = el('input', { type: 'text', value: x.tags || '', placeholder: 'rondo, trigger' });
    tags.addEventListener('change', function () { x.tags = tags.value.trim(); L.save(x); });
    bd.appendChild(el('div', { class: 'grid g2' }, [
      el('label', { class: 'f' }, [el('span', { text: 'Name' }), name]),
      el('label', { class: 'f' }, [el('span', { text: 'Tags' }), tags])
    ]));

    var detail = [['objective', 'Objective'], ['description', 'Set-up'],
      ['constraints', 'Constraints'], ['coachingPoints', 'Coaching points']]
      .filter(function (f) { return a[f[0]]; });
    if (detail.length) {
      var cols = el('div', { class: 'grid g2', style: 'margin-top:10px' });
      detail.forEach(function (f) {
        cols.appendChild(el('div', {}, [
          el('span', { class: 'eyebrow', text: f[1] }),
          el('p', { style: 'margin:2px 0 0;font-size:13px;white-space:pre-wrap', text: a[f[0]] })
        ]));
      });
      bd.appendChild(cols);
    }
    if (x.board && window.renderBoardPNG) {
      bd.appendChild(el('img', { class: 'thumb', style: 'margin-top:10px;max-width:230px',
        alt: 'Diagram for ' + x.name, src: window.renderBoardPNG(x.board, 0.38) }));
    }
    bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:12px' }, [
      el('span', { class: 'hint', text: x.from ? 'saved from ' + x.from : '' }),
      el('span', { class: 'sp' }),
      el('button', { class: 'btn warn sm', text: 'Delete', onclick: function () {
        if (!confirm('Delete "' + x.name + '" from the library?\n\nSessions that already used it keep their copy.')) return;
        L.remove(x.id); draw();
      } })
    ]));
    box.appendChild(bd);
    return box;
  }

  function draw() {
    renderThemes();
    var host = document.getElementById('list');
    host.innerHTML = '';
    var list = L.all().filter(function (x) {
      if (view && !L.hasTheme(x, view)) return false;
      if (!q) return true;
      var hay = [x.name, x.tags, L.themesOf(x).join(' '), x.moment, x.from, x.act.type,
        x.act.objective, x.act.description].join(' ').toLowerCase();
      return hay.indexOf(q.toLowerCase()) >= 0;
    });
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty',
        text: L.all().length ? 'Nothing matches.' : 'Nothing saved yet.' }));
      meta();
      return;
    }
    list.forEach(function (x) { host.appendChild(card(x)); });
    /* an entry saved with an uploaded picture needs the picture decoded before
       its thumbnail can show it */
    if (window.preloadBoardFrames) {
      var cold = list.map(function (x) { return x.board; }).filter(function (b) {
        return b && b.frame && !window.boardFrameSeen(b.frame);
      });
      if (cold.length) window.preloadBoardFrames(cold, draw);
    }
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:10px',
      text: list.length + ' of ' + L.all().length + ' shown.' }));
    meta();
  }

  function csv() {
    var rows = [['Name', 'Themes', 'Tags', 'Type', 'Numbers', 'Area', 'Intervals', 'Interval min',
      'Rest', 'Objective', 'Set-up', 'Constraints', 'Coaching points', 'Has diagram', 'Saved from']];
    L.all().forEach(function (x) {
      var a = x.act;
      rows.push([x.name, L.themesOf(x).join('; '), x.tags || '', a.type || '', a.numbers || '',
        [a.areaSize, a.area, a.channel].filter(Boolean).join(' '), a.intervals || '', a.time || '',
        a.rest || '', a.objective || '', a.description || '', a.constraints || '',
        a.coachingPoints || '', x.board ? 'Yes' : '', x.from || '']);
    });
    if (rows.length === 1) { S.toast('Nothing saved yet.'); return; }
    S.exportAs('Activity_library', rows, { title: 'Activity library' });
  }

  /* Printed once each, under the first theme, with the others named on the
     entry. A handbook that repeats an activity four times is not a handbook. */
  function buildPrint() {
    var b = L.byTheme();
    var seen = {};
    var html = '<h1 style="font-size:15pt;margin:0 0 8pt">Activity library</h1>' +
      '<p style="font-size:9pt;margin:0 0 10pt">' + L.all().length +
      ' activities. Each appears once, under the first topic it serves, with the others named beside it.</p>';
    Object.keys(b).sort().forEach(function (t) {
      var here = b[t].filter(function (x) { return !seen[x.id]; });
      if (!here.length) return;
      html += '<h2 class="rv-h">' + esc(t) + '  (' + here.length + ')</h2>';
      here.forEach(function (x) {
        seen[x.id] = 1;
        var a = x.act;
        var also = L.themesOf(x).filter(function (y) { return y !== t; });
        var facts = [a.numbers, a.areaSize, a.intervals && (a.intervals + ' x ' + a.time + ' min')]
          .filter(Boolean).join('  \u00b7  ');
        html += '<div class="rv-row"><p class="rv-lab">' + esc(x.name) +
          (a.type ? '<span class="rv-call">' + esc(a.type) + '</span>' : '') + '</p>' +
          (facts ? '<p style="margin:0 0 4pt;font-size:8pt">' + esc(facts) + '</p>' : '') +
          (also.length ? '<p style="margin:0 0 4pt;font-size:8pt"><em>also for ' +
            esc(also.join(', ')) + '</em></p>' : '') +
          '<div class="rv-full"><span class="rv-k">Set-up</span>' + esc(a.description || '-') + '</div>' +
          (a.coachingPoints ? '<div class="rv-full"><span class="rv-k">Coaching points</span>' +
            esc(a.coachingPoints) + '</div>' : '') + '</div>';
      });
    });
    document.getElementById('printOnly').innerHTML = html;
    document.body.classList.add('has-printsheet', 'reviewsheet');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var t;
    document.getElementById('q').addEventListener('input', function () {
      var v = this.value;
      clearTimeout(t); t = setTimeout(function () { q = v; draw(); }, 150);
    });
    document.getElementById('themeSel').addEventListener('change', function () { view = this.value; draw(); });
    document.getElementById('btnCsv').addEventListener('click', csv);
    document.getElementById('btnPrint').addEventListener('click', function () { buildPrint(); window.print(); });
    window.addEventListener('beforeprint', buildPrint);
    draw();
  });
})();

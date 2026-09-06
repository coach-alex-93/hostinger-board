/* lists-page.js — the list editor */
(function () {
  'use strict';
  var S = window.Store, L = window.Lists, el = S.el;
  var key = L.registry[0].key;

  function draw() {
    var spec = L.registry.filter(function (r) { return r.key === key; })[0];
    var c = L.counts(key);
    document.getElementById('listTitle').textContent = spec.label;
    document.getElementById('listMeta').textContent =
      c.total + ' in use · ' + c.shipped + ' shipped, ' + c.added + ' added, ' + c.hidden + ' hidden · used in ' + spec.where;

    var host = document.getElementById('items');
    host.innerHTML = '';
    var live = L.get(key);
    var shippedAll = L.shipped(key);
    var hidden = shippedAll.filter(function (x) { return live.indexOf(x) < 0; });

    if (!live.length && !hidden.length) {
      host.appendChild(el('div', { class: 'empty', text: 'Nothing here yet. Add your first entry above.' }));
      return;
    }

    var ul = el('ul', { class: 'list' });
    live.forEach(function (x) {
      var own = shippedAll.indexOf(x) < 0;
      ul.appendChild(el('li', {}, [
        el('span', { class: 'chip ' + (own ? 'ao' : ''), text: own ? 'Yours' : 'Shipped' }),
        el('div', { class: 'grow', text: x }),
        el('button', {
          class: 'btn ghost sm', text: own ? 'Delete' : 'Hide',
          onclick: function () { L.remove(key, x); draw(); }
        })
      ]));
    });
    host.appendChild(ul);

    if (hidden.length) {
      host.appendChild(el('p', { class: 'eyebrow', style: 'margin:18px 0 6px', text: 'Hidden' }));
      var ul2 = el('ul', { class: 'list' });
      hidden.forEach(function (x) {
        ul2.appendChild(el('li', {}, [
          el('span', { class: 'chip off', text: 'Hidden' }),
          el('div', { class: 'grow', style: 'color:var(--slate)', text: x }),
          el('button', { class: 'btn ghost sm', text: 'Restore', onclick: function () { L.add(key, x); draw(); } })
        ]));
      });
      host.appendChild(ul2);
    }
  }

  /* the lists that are objects rather than words */
  function renderObjects() {
    var host = document.getElementById('objLists');
    if (!host || !L.OBJ) return;
    host.innerHTML = '';
    Object.keys(L.OBJ).forEach(function (key) {
      var spec = L.OBJ[key];
      var list = L.objGet(key);
      var box = el('div', { class: 'act', style: 'border-left-color:var(--navy)' });
      box.appendChild(el('div', { class: 'act-hd' }, [
        el('span', { class: 'lab', text: spec.label }),
        el('span', { class: 'chip', text: list.length + ' entries' }),
        L.objEdited(key) ? el('span', { class: 'chip at', text: 'edited' }) : null,
        el('span', { class: 'sp' }),
        el('button', { class: 'btn ghost sm', text: 'Add', onclick: function () {
          var blank = {};
          spec.fields.forEach(function (f) { blank[f[0]] = ''; });
          if (spec.listField) blank[spec.listField[0]] = [];
          if (spec.successField) blank[spec.successField] = [];
          list.push(blank); L.objSet(key, list); renderObjects();
        } }),
        L.objEdited(key) ? el('button', { class: 'btn warn sm', text: 'Reset', onclick: function () {
          if (!confirm('Reset ' + spec.label + ' to what shipped?')) return;
          L.objReset(key); location.reload();
        } }) : null
      ]));
      var bd = el('div', { class: 'act-bd' });
      list.forEach(function (item, i) {
        var row = el('div', { style: 'border-top:1px solid var(--chalk-3);padding-top:10px;margin-top:10px' });
        var g = el('div', { class: 'grid g3' });
        spec.fields.forEach(function (f) {
          var inp = el('input', { type: f[2] === 'number' ? 'number' : 'text',
            value: item[f[0]] == null ? '' : item[f[0]], step: 'any' });
          inp.addEventListener('change', function () {
            item[f[0]] = f[2] === 'number' ? (inp.value === '' ? '' : +inp.value) : inp.value;
            L.objSet(key, list);
          });
          g.appendChild(el('label', { class: 'f' }, [el('span', { text: f[1] }), inp]));
        });
        row.appendChild(g);

        if (spec.listField) {
          var lf = spec.listField, sub = item[lf[0]] || [];
          row.appendChild(el('span', { class: 'eyebrow', style: 'display:block;margin-top:8px', text: lf[1] }));
          var wrap = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px' });
          sub.forEach(function (o, j) {
            var txt = lf[2] ? o[lf[2][0]] : o;
            var inp = el('input', { type: 'text', value: txt, style: 'width:auto;max-width:210px' });
            inp.addEventListener('change', function () {
              if (lf[2]) sub[j][lf[2][0]] = inp.value; else sub[j] = inp.value;
              L.objSet(key, list);
            });
            var cell = el('div', { style: 'display:flex;align-items:center;gap:3px' }, [inp]);
            if (spec.successField) {
              var cb = el('input', { type: 'checkbox', title: 'Counts as a success' });
              cb.checked = (item[spec.successField] || []).indexOf(txt) >= 0;
              cb.addEventListener('change', function () {
                var ss = item[spec.successField] || [];
                var k2 = ss.indexOf(inp.value);
                if (cb.checked && k2 < 0) ss.push(inp.value);
                if (!cb.checked && k2 >= 0) ss.splice(k2, 1);
                item[spec.successField] = ss;
                L.objSet(key, list);
              });
              cell.appendChild(cb);
            }
            cell.appendChild(el('button', { class: 'rmx', type: 'button', text: '\u2715',
              onclick: function () { sub.splice(j, 1); L.objSet(key, list); renderObjects(); } }));
            wrap.appendChild(cell);
          });
          wrap.appendChild(el('button', { class: 'btn ghost sm', text: '+',
            onclick: function () {
              sub.push(lf[2] ? { t: 'New', v: sub.length + 1 } : 'New');
              item[lf[0]] = sub; L.objSet(key, list); renderObjects();
            } }));
          row.appendChild(wrap);
          if (spec.successField) {
            row.appendChild(el('p', { class: 'hint', style: 'margin:4px 0 0',
              text: 'Tick the outcomes that count as a success.' }));
          }
        }
        row.appendChild(el('button', { class: 'btn warn sm', style: 'margin-top:8px', text: 'Remove this entry',
          onclick: function () { list.splice(i, 1); L.objSet(key, list); renderObjects(); } }));
        bd.appendChild(row);
      });
      box.appendChild(bd);
      host.appendChild(box);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sel = document.getElementById('listSel');
    var groups = {};
    L.registry.forEach(function (r) { (groups[r.where] = groups[r.where] || []).push(r); });
    Object.keys(groups).forEach(function (g) {
      var og = el('optgroup', { label: g });
      groups[g].forEach(function (r) { og.appendChild(el('option', { value: r.key, text: r.label })); });
      sel.appendChild(og);
    });
    sel.value = key;
    sel.addEventListener('change', function () { key = sel.value; draw(); });

    function addNow() {
      var i = document.getElementById('newItem');
      if (!i.value.trim()) return;
      L.add(key, i.value);
      i.value = '';
      draw();
    }
    document.getElementById('btnAdd').addEventListener('click', addNow);
    document.getElementById('newItem').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addNow(); }
    });
    document.getElementById('btnReset').addEventListener('click', function () {
      if (!confirm('Reset this list to what ships with the site?')) return;
      L.reset(key); draw();
    });
    document.getElementById('btnResetAll').addEventListener('click', function () {
      if (!confirm('Reset every list? Your additions across all of them are removed.')) return;
      L.reset(); draw();
    });
    document.getElementById('btnExport').addEventListener('click', function () {
      S.download('SessionBoard_lists.json', JSON.stringify({
        kind: 'sessionboard.lists', version: 1,
        lists: JSON.parse(localStorage.getItem(L.KEY) || '{}')
      }, null, 1));
    });
    document.getElementById('btnImport').addEventListener('click', function () {
      S.pickFile('.json', function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { S.toast('Not valid JSON.'); return; }
        if (j.kind !== 'sessionboard.lists') { S.toast('That is not a lists file.'); return; }
        if (!confirm('Replace your list edits with this file?')) return;
        localStorage.setItem(L.KEY, JSON.stringify(j.lists || {}));
        S.toast('Lists imported.'); draw();
      });
    });
    renderObjects();
    document.getElementById('btnExportModel').addEventListener('click', function () {
      var name = prompt('Name this model', 'Game model') || 'Game model';
      var withProfiles = confirm('Include the role profiles?\n\nOK includes them, Cancel sends principles and vocabulary only.');
      var j = L.exportModel({ name: name, profiles: withProfiles });
      if (!j.principles.length) { S.toast('There is no model here to export yet.'); return; }
      S.download('Model_' + name.replace(/[^\w-]+/g, '_') + '.json', JSON.stringify(j, null, 1));
    });
    document.getElementById('btnImportModel').addEventListener('click', function () {
      S.pickFile('.json', function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { S.toast('Not valid JSON.'); return; }
        if (!confirm('Import this model?\n\nIt replaces the principles and profiles here. Sessions, players and fixtures are untouched.')) return;
        var r = L.importModel(j);
        S.toast(r.msg);
        if (r.ok) setTimeout(function () { location.reload(); }, 800);
      });
    });
    draw();
  });
})();

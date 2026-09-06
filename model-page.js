/* model-page.js — editing the principles */
(function () {
  'use strict';
  var S = window.Store, M = window.Model, L = window.Lists, el = S.el, esc = S.esc;

  function meta() {
    var n = M.all().length;
    var mm = document.getElementById('modelMeta');
    if (mm) mm.textContent =
      n + ' principle' + (n === 1 ? '' : 's') + (M.isEdited() ? ' · edited from what shipped' : ' · as shipped');
  }

  function card(p, i, list) {
    var box = el('div', { class: 'act', style: 'border-left-color:var(--m-' + S.momentKey(p.moment) + ')' });

    var head = el('div', { class: 'act-hd' });
    var code = el('input', { type: 'text', value: p.clubCode || p.code, style: 'width:110px;font-family:var(--mono)' });
    code.addEventListener('change', function () { p.clubCode = code.value.trim(); M.upsert(p); draw(); });
    var nm = el('input', { type: 'text', value: p.clubName || p.name,
      style: 'flex:1 1 220px;font-family:var(--display);font-size:16px;text-transform:uppercase;letter-spacing:.04em' });
    nm.addEventListener('change', function () { p.clubName = nm.value.trim(); M.upsert(p); draw(); });
    head.appendChild(code);
    head.appendChild(nm);
    head.appendChild(el('span', { class: 'sp' }));
    head.appendChild(el('button', { class: 'btn ghost sm', text: '\u2191',
      onclick: function () { M.move(p.code, -1); draw(); } }));
    head.appendChild(el('button', { class: 'btn ghost sm', text: '\u2193',
      onclick: function () { M.move(p.code, 1); draw(); } }));
    head.appendChild(el('button', { class: 'btn warn sm', text: 'Delete', onclick: function () {
      if (!confirm('Delete ' + (p.clubCode || p.code) + '?\n\nSessions that used it keep the code but will show it as missing.')) return;
      M.remove(p.code); draw();
    } }));
    box.appendChild(head);

    var bd = el('div', { class: 'act-bd' });
    var g = el('div', { class: 'grid g4' });

    function field(label, key, ph) {
      var inp = el('input', { type: 'text', value: p[key] || '', placeholder: ph || '' });
      inp.addEventListener('change', function () { p[key] = inp.value; M.upsert(p); });
      return el('label', { class: 'f' }, [el('span', { text: label }), inp]);
    }
    g.appendChild(field('Your own name', 'name', 'if it differs from the club wording'));
    /* The cue belongs to the principle, which is where A2 defines it. It is not
       repeated on the session plan, so there is one place it can be wrong. */
    g.appendChild(field('Player-facing cue', 'cue', 'wide \u00b7 close \u00b7 quick'));

    var mo = el('select');
    M.MOMENTS.forEach(function (m) { mo.appendChild(el('option', { value: m, text: m })); });
    mo.value = p.moment;
    mo.addEventListener('change', function () {
      p.moment = mo.value;
      p.phases = M.PHASES[mo.value].slice();
      M.upsert(p); draw();
    });
    g.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Moment' }), mo]));

    var ty = el('select');
    ['Foundational', 'Developmental', ''].forEach(function (t) {
      ty.appendChild(el('option', { value: t, text: t || '- none -' }));
    });
    ty.value = p.type || '';
    ty.addEventListener('change', function () { p.type = ty.value; M.upsert(p); });
    g.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Type' }), ty]));
    bd.appendChild(g);

    var ph = el('div', { style: 'margin-top:12px' });
    ph.appendChild(el('span', { class: 'eyebrow', text: 'Phases it belongs to' }));
    var phBox = el('div', { class: 'subs', style: 'max-height:none' });
    (M.PHASES[p.moment] || []).forEach(function (x) {
      var cb = el('input', { type: 'checkbox' });
      cb.checked = (p.phases || []).indexOf(x) >= 0;
      cb.addEventListener('change', function () {
        p.phases = p.phases || [];
        var k = p.phases.indexOf(x);
        if (cb.checked && k < 0) p.phases.push(x);
        if (!cb.checked && k >= 0) p.phases.splice(k, 1);
        M.upsert(p);
      });
      phBox.appendChild(el('label', {}, [cb, el('span', { text: x })]));
    });
    ph.appendChild(phBox);
    bd.appendChild(ph);

    var sp = el('div', { style: 'margin-top:12px' });
    var subs = L.subsFor(p.code);
    sp.appendChild(el('span', { class: 'eyebrow', text: 'Sub-principles (' + subs.length + ')' }));
    var spBox = el('div', { class: 'subs', style: 'max-height:200px' });
    subs.forEach(function (s2) {
      var kids2 = (s2.detail || []);
      spBox.appendChild(el('label', {}, [
        el('code', { text: s2.code }),
        el('span', {}, [
          el('span', { text: s2.text }),
          kids2.length ? el('span', { class: 'hint', style: 'display:block;font-size:11px',
            text: kids2.join(' \u00b7 ') }) : null
        ]),
        el('button', { class: 'rmx', type: 'button', text: '+', title: 'Add detail under this',
          onclick: function (e) {
            e.preventDefault();
            var t = prompt('Detail under ' + s2.code);
            if (!t) return;
            var all2 = L.subsFor(p.code);
            var rec = all2.filter(function (x) { return x.code === s2.code; })[0];
            if (!rec) return;
            rec.detail = (rec.detail || []).concat([t.trim()]);
            L.removeSub(p.code, s2.code);
            var made = L.addSub(p.code, rec.text);
            if (made) {
              var d2 = JSON.parse(localStorage.getItem('ncfc.lists.v1') || '{}');
              var key = 'subs:' + p.code;
              (d2[key].add || []).forEach(function (r) { if (r.code === made.code) r.detail = rec.detail; });
              localStorage.setItem('ncfc.lists.v1', JSON.stringify(d2));
            }
            draw();
          } }),
        el('button', { class: 'rmx', type: 'button', text: '\u2715', title: 'Remove', onclick: function (e) {
          e.preventDefault();
          if (!confirm('Remove this sub-principle?')) return;
          L.removeSub(p.code, s2.code); draw();
        } })
      ]));
    });
    if (!subs.length) spBox.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'None yet.' }));
    sp.appendChild(spBox);
    sp.appendChild(el('button', { class: 'btn ghost sm', style: 'margin-top:6px', text: '+ Add a sub-principle',
      onclick: function () {
        var t = prompt('New sub-principle for ' + (p.clubCode || p.code));
        if (!t) return;
        L.addSub(p.code, t); draw();
      } }));
    bd.appendChild(sp);

    /* player actions the principle demands, and a third level under a
       sub-principle for the detail that used to live in a cue */
    var pa = el('div', { style: 'margin-top:12px' });
    pa.appendChild(el('span', { class: 'eyebrow', text: 'Player actions this principle demands' }));
    p.actions = p.actions || [];
    var paTags = el('div', { class: 'ivtags', style: 'margin:5px 0' });
    p.actions.forEach(function (x) {
      paTags.appendChild(el('button', { class: 'ivtag', type: 'button', text: x + ' \u00d7',
        onclick: function () { p.actions = p.actions.filter(function (y) { return y !== x; }); M.upsert(p); draw(); } }));
    });
    if (!p.actions.length) paTags.appendChild(el('span', { class: 'hint', text: 'None yet.' }));
    pa.appendChild(paTags);
    pa.appendChild(el('button', { class: 'btn ghost sm', text: '+ Choose player actions', onclick: function () {
      L.multiPick({
        title: 'Player actions for ' + (p.clubCode || p.code),
        groups: L.getGroups('playerActions'), groupKey: 'playerActions',
        onPick: function (picked) {
          p.actions = (p.actions || []).concat(picked.filter(function (x) { return p.actions.indexOf(x) < 0; }));
          M.upsert(p); draw();
        }
      });
    } }));
    bd.appendChild(pa);

    box.appendChild(bd);
    return box;
  }

  function draw() {
    var host = document.getElementById('list');
    host.innerHTML = '';
    var list = M.all();
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'No principles yet. ' }),
        el('strong', { text: 'New principle' }),
        el('span', { text: ' starts one, or import a model file someone has shared.' })
      ]));
      meta();
      return;
    }
    var byMoment = {};
    list.forEach(function (p) { (byMoment[p.moment] = byMoment[p.moment] || []).push(p); });
    M.MOMENTS.forEach(function (m) {
      if (!byMoment[m]) return;
      host.appendChild(el('p', { class: 'subhd', html: esc(m) +
        '<small>' + byMoment[m].length + ' principle' + (byMoment[m].length === 1 ? '' : 's') + '</small>' }));
      byMoment[m].forEach(function (p, i) { host.appendChild(card(p, i, list)); });
    });
    meta();
  }

  /* ---------- identity, style and formations ----------
     A game model is more than a list of principles. What the team is trying to
     look like, and the shapes it does it in, belong beside them. */
  var GK = 'ncfc.gamemodel.v1';
  function gm() {
    try { return JSON.parse(localStorage.getItem(GK) || '{}') || {}; } catch (e) { return {}; }
  }
  function gmSave(d) {
    try { localStorage.setItem(GK, JSON.stringify(d)); } catch (e) { S.toast('Could not save.'); }
    var n = document.getElementById('saveState');
    if (n) n.textContent = 'Saved';
  }

  function renderStyle() {
    var d = gm();
    var idn = document.getElementById('gm_identity');
    if (idn) {
      idn.value = d.identity || '';
      idn.oninput = function () { var x = gm(); x.identity = idn.value; gmSave(x); };
    }
    /* the identity line draws on the influences, and each moment on the style
       entries that already belong to it, so nothing is typed twice */
    if (idn) {
      var idBtn = document.getElementById('gm_idPick');
      if (!idBtn) {
        idBtn = el('button', { class: 'btn ghost sm no-print', type: 'button', id: 'gm_idPick',
          style: 'margin-top:5px', text: 'Choose from the influences' });
        idn.parentNode.appendChild(idBtn);
        idBtn.addEventListener('click', function () {
          L.multiPick({
            title: 'What influences the model', items: influenceList(), listKey: 'influences',
            onPick: function (picked) {
              var x = gm();
              x.identity = (x.identity ? x.identity.replace(/\s*$/, '') + '\n' : '') + picked.join('\n');
              gmSave(x); idn.value = x.identity;
            }
          });
        });
      }
    }

    var host = document.getElementById('styleBox');
    if (!host) return;
    host.innerHTML = '';
    d.style = d.style || {};
    M.MOMENTS.forEach(function (m) {
      var t = el('textarea', { rows: 3, placeholder: 'How we want to play in this moment' });
      t.value = d.style[m] || '';
      t.addEventListener('input', function () {
        var x = gm(); x.style = x.style || {}; x.style[m] = t.value; gmSave(x);
      });
      var mine = styleAll().filter(function (e) { return e.moment === m; });
      var pick = el('button', { class: 'btn ghost sm no-print', type: 'button', style: 'margin-top:5px',
        text: 'Choose from the ' + mine.length + ' entries in this moment' });
      pick.addEventListener('click', function () {
        if (!mine.length) { S.toast('Write a style entry for this moment first, below.'); return; }
        L.multiPick({
          title: m,
          items: mine.map(function (e) { return e.title + ' \u2014 ' + e.text; }),
          onPick: function (picked) {
            var x = gm(); x.style = x.style || {};
            x.style[m] = (x.style[m] ? x.style[m].replace(/\s*$/, '') + '\n' : '') + picked.join('\n');
            gmSave(x); t.value = x.style[m];
          }
        });
      });
      host.appendChild(el('label', { class: 'f' }, [
        el('span', { text: m }), t, pick,
        el('p', { class: 'hint', style: 'margin-top:4px',
          text: (window.PRINCIPLES || []).filter(function (p) { return p.moment === m; }).length +
            ' principles and ' + mine.length + ' style entries sit in this moment' })
      ]));
    });
  }

  /* ---------- the style library ----------
     Forty-odd ideas out of the game model document, each on its own footing so
     it can be edited, added to, or attached to a session. */
  var SK = 'ncfc.style.v1';
  function styleAll() {
    try {
      var mine = JSON.parse(localStorage.getItem(SK) || 'null');
      if (mine) return mine;
    } catch (e) {}
    return JSON.parse(JSON.stringify((window.STYLE || {}).entries || []));
  }
  function styleSave(l) {
    try { localStorage.setItem(SK, JSON.stringify(l)); } catch (e) { S.toast('Could not save.'); }
  }
  var styleView = 'all';

  /* the influences are a list like any other now: add to them, remove them */
  function influenceList() {
    var shipped = (window.STYLE || {}).influences || [];
    var extra = L.get('influences') || [];
    var out = shipped.slice();
    extra.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  function renderInfluences() {
    var host = document.getElementById('influences');
    if (!host) return;
    var inf = influenceList();
    host.innerHTML = '';
    if (!inf.length) { host.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'None read from the document.' })); return; }
    host.innerHTML = '';
    var ul = el('ul', { class: 'hint', style: 'margin:0;padding-left:18px;line-height:1.7' });
    inf.forEach(function (x) { ul.appendChild(el('li', { text: x })); });
    host.appendChild(ul);
    host.appendChild(el('button', {
      class: 'btn ghost sm no-print', style: 'margin-top:8px', text: '+ Add an influence',
      onclick: function () {
        var v = prompt('What else influences the model?');
        if (!v) return;
        L.add('influences', v.trim());
        renderInfluences(); renderStyle();
        S.toast('Added. It is in the list for good.');
      }
    }));
  }

  function renderStyleList() {
    var host = document.getElementById('styleList');
    if (!host) return;
    var list = styleAll();
    var sel = document.getElementById('styleFilter');
    if (sel && !sel.options.length) {
      var moms = ['all'].concat(M.MOMENTS).concat(['Set plays']);
      moms.forEach(function (m) {
        sel.appendChild(el('option', { value: m, text: m === 'all' ? 'Every moment' : m }));
      });
      sel.value = styleView;
      sel.addEventListener('change', function () { styleView = sel.value; renderStyleList(); });
    }
    host.innerHTML = '';
    var shown = list.filter(function (e) { return styleView === 'all' || e.moment === styleView; });
    if (!shown.length) {
      host.appendChild(el('div', { class: 'empty', text: 'Nothing here yet.' }));
      return;
    }
    shown.forEach(function (e) {
      var i = list.indexOf(e);
      var box = el('div', { class: 'act', style: 'border-left-color:var(--m-' +
        (e.moment === 'Set plays' ? 'at' : S.momentKey(e.moment)) + ')' });
      var ti = el('input', { type: 'text', value: e.title,
        style: 'flex:1 1 220px;font-family:var(--display);font-size:15px;text-transform:uppercase;letter-spacing:.04em' });
      ti.addEventListener('input', function () { var l = styleAll(); l[i].title = ti.value; styleSave(l); });
      var mo = el('select', { style: 'width:auto' });
      M.MOMENTS.concat(['Set plays']).forEach(function (m) { mo.appendChild(el('option', { value: m, text: m })); });
      mo.value = e.moment;
      mo.addEventListener('change', function () { var l = styleAll(); l[i].moment = mo.value; styleSave(l); renderStyleList(); });
      box.appendChild(el('div', { class: 'act-hd' }, [ti, mo, el('span', { class: 'sp' }),
        el('button', { class: 'btn warn sm', text: 'Remove', onclick: function () {
          var l = styleAll(); l.splice(i, 1); styleSave(l); renderStyleList();
        } })]));
      var tx = el('textarea', { rows: 3 });
      tx.value = e.text;
      tx.addEventListener('input', function () { var l = styleAll(); l[i].text = tx.value; styleSave(l); });
      box.appendChild(el('div', { class: 'act-bd' }, [tx]));
      host.appendChild(box);
    });
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:10px',
      text: shown.length + ' of ' + list.length + ' entries shown.' }));
  }

  function renderForms() {
    var d = gm();
    d.formations = d.formations || [];
    var host = document.getElementById('forms');
    if (!host) return;
    host.innerHTML = '';
    if (!d.formations.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'None yet. A formation here is a shape plus what it is for, and it fills the shape fields on a session plan.' }));
      return;
    }
    d.formations.forEach(function (f, i) {
      var box = el('div', { class: 'act', style: 'border-left-color:var(--turf)' });
      var nm = el('input', { type: 'text', value: f.name || '', placeholder: 'Name it',
        style: 'flex:1 1 180px;font-family:var(--display);font-size:16px;text-transform:uppercase;letter-spacing:.05em' });
      nm.addEventListener('input', function () { var x = gm(); x.formations[i].name = nm.value; gmSave(x); });
      box.appendChild(el('div', { class: 'act-hd' }, [
        nm, el('span', { class: 'sp' }),
        el('button', { class: 'btn warn sm', text: 'Remove', onclick: function () {
          var x = gm(); x.formations.splice(i, 1); gmSave(x); renderForms();
        } })
      ]));
      var bd = el('div', { class: 'act-bd' });
      var g = el('div', { class: 'grid g4' });
      [['shapeIn', 'Shape in possession', '3-2-5'], ['shapeOut', 'Shape out of possession', '4-4-2'],
       ['whenUsed', 'When we use it', 'against a mid-block'], ['against', 'What it answers', 'a front two']]
        .forEach(function (fd) {
          var inp = el('input', { type: 'text', value: f[fd[0]] || '', placeholder: fd[2] });
          inp.addEventListener('input', function () { var x = gm(); x.formations[i][fd[0]] = inp.value; gmSave(x); });
          g.appendChild(el('label', { class: 'f' }, [el('span', { text: fd[1] }), inp]));
        });
      bd.appendChild(g);
      var nt = el('textarea', { rows: 3, placeholder: 'Roles that change in this shape, and the trade you accept' });
      nt.value = f.notes || '';
      nt.addEventListener('input', function () { var x = gm(); x.formations[i].notes = nt.value; gmSave(x); });
      bd.appendChild(el('label', { class: 'f', style: 'margin-top:12px' }, [el('span', { text: 'Notes' }), nt]));

      /* the shape draws itself; edit it and the drawing is kept instead */
      var dia = el('div', { class: 'diagrow', style: 'margin-top:12px;max-width:230px' });
      var st = f.diagram && f.diagram.objects && f.diagram.objects.length
        ? f.diagram
        : (f.shapeIn || f.shapeOut ? window.Lineup.diagram(f.shapeIn || f.shapeOut) : null);
      if (st) {
        dia.appendChild(el('img', { class: 'thumb', alt: 'Formation ' + (f.name || ''),
          src: window.renderBoardPNG(st, 0.42) }));
      } else {
        dia.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'Type a shape and it draws itself.' }));
      }
      dia.appendChild(el('div', { class: 'btnrow no-print' }, [
        el('button', { class: 'btn ghost sm', text: st ? 'Edit the drawing' : 'Draw it',
          onclick: function () { openFormationBoard(i, st); } }),
        f.diagram ? el('button', { class: 'btn ghost sm', text: 'Back to the shape',
          onclick: function () { var x = gm(); delete x.formations[i].diagram; gmSave(x); renderForms(); } }) : null,
        el('span', { class: 'hint', text: f.diagram ? 'drawn by you' : 'from the shape' })
      ]));
      bd.appendChild(dia);

      box.appendChild(bd);
      host.appendChild(box);
    });
  }

  /* the same board the planner uses, opened on a formation */
  var fBoard = null, fIndex = -1;
  function openFormationBoard(i, st) {
    var modal = document.getElementById('formModal');
    if (!modal) return;
    fIndex = i;
    modal.hidden = false;
    if (!fBoard) {
      fBoard = new window.Board(document.getElementById('formBoard'));
      fBoard.onchange = function () { if (window.buildBoardRail) window.buildBoardRail(fBoard, 'formRail'); };
      /* same shortcuts as the planner's diagram, since it is the same board */
      document.addEventListener('keydown', function (e) {
        if (document.getElementById('formModal').hidden) return;
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); fBoard.deleteSel(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); fBoard.duplicateSel(); }
      });
    }
    var d = gm();
    var f = d.formations[i] || {};
    fBoard.setState(st || window.Lineup.diagram(f.shapeIn || f.shapeOut || '4-3-3'));
    document.getElementById('formTitle').textContent =
      'Formation \u2014 ' + (f.name || f.shapeIn || 'shape');
    if (window.buildBoardRail) window.buildBoardRail(fBoard, 'formRail');
  }
  function closeFormationBoard(commit) {
    var modal = document.getElementById('formModal');
    if (commit && fIndex >= 0) {
      var d = gm();
      d.formations[fIndex].diagram = fBoard.getState();
      gmSave(d);
      renderForms();
    }
    modal.hidden = true;
    fIndex = -1;
  }


  /* the same board engine the planner uses, in a modal */
  var fBoard = null, fIndex = -1;
  function renderFeeds() {
    var host = document.getElementById('feeds');
    if (!host) return;
    host.innerHTML = '';
    var subs = 0;
    (window.PRINCIPLES || []).forEach(function (p) { subs += L.subsFor(p.code).length; });
    var profs = 0;
    try { profs = (JSON.parse(localStorage.getItem('ncfc.profiles.v1') || 'null') || window.PROFILES || []).length; } catch (e) {}
    [['model.html#profiles', 'Player profiles', 'What each position owes in each moment', profs + ' positions'],
     ['lists.html', 'Vocabulary', 'Player actions, cues, phases and the rest', ''],
     ['kpi.html', 'KPIs', 'How you measure whether it is happening', ''],
     ['periodization.html', 'Sequencing', 'Which principle is coached when', '']]
      .forEach(function (t) {
        var a = el('a', { class: 'hubtile', href: t[0] });
        a.appendChild(el('b', { text: t[1] }));
        if (t[3]) a.appendChild(el('span', { class: 'chip', text: t[3] }));
        a.appendChild(el('span', { class: 'hint', text: t[2] }));
        host.appendChild(a);
      });
    var meta = document.getElementById('modelMeta');
    if (meta) meta.textContent = meta.textContent + ' · ' + subs + ' sub-principles';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var fc = document.getElementById('formCancel');
    if (fc) fc.addEventListener('click', function () { closeFormationBoard(false); });
    var fi = document.getElementById('formInsert');
    if (fi) fi.addEventListener('click', function () { closeFormationBoard(true); });

    document.getElementById('btnAddStyle').addEventListener('click', function () {
      var t = prompt('Heading for the new style entry');
      if (!t) return;
      var l = styleAll();
      l.unshift({ moment: styleView === 'all' ? M.MOMENTS[0] : styleView, title: t, text: '' });
      styleSave(l); renderStyleList();
    });
    document.getElementById('btnAddForm').addEventListener('click', function () {
      var x = gm();
      x.formations = x.formations || [];
      x.formations.push({ name: '', shapeIn: '', shapeOut: '', whenUsed: '', against: '', notes: '' });
      gmSave(x); renderForms();
    });
    document.getElementById('btnAdd').addEventListener('click', function () {
      var c = prompt('Code for the new principle, for example IP18');
      if (!c) return;
      c = c.trim().replace(/[^\w.]/g, '');
      if (!M.codeFree(c)) { S.toast('That code is already used.'); return; }
      var p = M.blank();
      p.code = c;
      p.clubCode = c.replace(/^(IP|OP|TR)/, '$1.');
      p.name = p.clubName = prompt('Name it', 'New principle') || 'New principle';
      M.upsert(p); draw();
    });
    document.getElementById('btnReset').addEventListener('click', function () {
      if (!confirm('Reset every principle to what shipped?\n\nYour sub-principles stay.')) return;
      M.reset(); draw(); S.toast('Model reset.');
    });
    document.getElementById('btnExport').addEventListener('click', function () {
      var name = prompt('Name this model', 'Game model') || 'Game model';
      var j = L.exportModel({ name: name });
      if (!j.principles.length) { S.toast('Nothing to export yet.'); return; }
      S.download('Model_' + name.replace(/[^\w-]+/g, '_') + '.json', JSON.stringify(j, null, 1));
    });
    document.getElementById('btnImport').addEventListener('click', function () {
      S.pickFile('.json', function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { S.toast('Not valid JSON.'); return; }
        if (!confirm('Import this model? It replaces the principles here.')) return;
        var r = L.importModel(j);
        S.toast(r.msg);
        if (r.ok) setTimeout(function () { location.reload(); }, 700);
      });
    });
    draw();
    renderStyle();
    renderInfluences();
    renderStyleList();
    renderForms();
    renderFeeds();
  });
})();

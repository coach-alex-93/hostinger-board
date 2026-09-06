/* ============================================================
   idp.js — individual development plans
   Criteria come from the EVB workbook, one sheet per position.
   Review windows are per plan and editable, so they can sit on
   the assignment cycle rather than the club's calendar year.
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el, esc = S.esc;

  var K_IDP = 'ncfc.idp.v1';
  /* Traffic light, mapped onto the benchmark tiers so exports stay in your language */
  var TIERS = [
    { v: 'Foundation', short: 'F', dot: 'red', title: 'Foundation - not yet reliable' },
    { v: 'Developing', short: 'D', dot: 'amber', title: 'Developing - inconsistent' },
    { v: 'Advanced', short: 'A', dot: 'green', title: 'Advanced - reliable under pressure' }
  ];
  var TIER_SHORT = { '': '-', 'Foundation': 'F', 'Developing': 'D', 'Advanced': 'A' };
  var TIER_RANK = { 'Foundation': 1, 'Developing': 2, 'Advanced': 3 };

  var plan = S.defaultPlanId();
  var playerId = '';

  function read() {
    try { return JSON.parse(localStorage.getItem(K_IDP) || '{}'); } catch (e) { return {}; }
  }
  function write(d) {
    try { localStorage.setItem(K_IDP, JSON.stringify(d)); return true; }
    catch (e) { S.toast('Could not save. Export a backup and clear some space.'); return false; }
  }
  function db() {
    var d = read();
    d.players = d.players || {};
    d.marks = d.marks || {};
    d.windows = d.windows || {};
    return d;
  }

  /* ---------- review windows ----------
     Default to the plan's own blocks, so the windows land on the
     assignment cycle instead of March / June / September. */
  function windowsFor(id) {
    var d = db();
    if (d.windows[id]) return d.windows[id];
    var blocks = S.planBlocks(id);
    var w = blocks.length
      ? blocks.map(function (b) { return { label: b.name, date: b.end }; })
      : [{ label: 'Baseline', date: '' }, { label: 'Review 1', date: '' },
         { label: 'Review 2', date: '' }, { label: 'End of season', date: '' }];
    return w.slice(0, 5);
  }
  function saveWindows(id, w) { var d = db(); d.windows[id] = w; write(d); }

  function editWindows() {
    var w = windowsFor(plan);
    var back = el('div', {
      style: 'position:fixed;inset:0;background:rgba(10,23,38,.55);z-index:150;display:flex;align-items:center;justify-content:center;padding:20px',
      onclick: function (e) { if (e.target === back) back.remove(); }
    });
    var panel = el('div', { class: 'card', style: 'max-width:560px;width:100%;max-height:80vh;overflow:auto' });
    panel.appendChild(el('div', { class: 'card-hd' }, [
      el('h2', { text: 'Review windows' }),
      el('p', { class: 'hint', style: 'margin-left:auto', text: S.planLabel(plan) })
    ]));
    var bd = el('div', { class: 'card-bd' });
    bd.appendChild(el('p', { class: 'hint', style: 'margin:0 0 12px', text: 'These default to the blocks on this plan. Rename or redate them to match your assignment cycle.' }));
    var list = el('div');
    function draw() {
      list.innerHTML = '';
      w.forEach(function (x, i) {
        var lab = el('input', { type: 'text', value: x.label || '' });
        lab.addEventListener('input', function () { x.label = lab.value; });
        var dt = el('input', { type: 'date', value: x.date || '' });
        dt.addEventListener('input', function () { x.date = dt.value; });
        list.appendChild(el('div', { class: 'grid g3', style: 'margin-bottom:8px;align-items:end' }, [
          el('label', { class: 'f' }, [el('span', { text: 'Window ' + (i + 1) }), lab]),
          el('label', { class: 'f' }, [el('span', { text: 'Closes' }), dt]),
          el('button', {
            class: 'btn warn sm', text: 'Remove',
            onclick: function () { w.splice(i, 1); draw(); }
          })
        ]));
      });
    }
    draw();
    bd.appendChild(list);
    bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:12px' }, [
      el('button', {
        class: 'btn ghost sm', text: 'Add a window',
        onclick: function () { if (w.length < 5) { w.push({ label: 'Window ' + (w.length + 1), date: '' }); draw(); } }
      }),
      el('button', {
        class: 'btn turf', text: 'Save', onclick: function () {
          saveWindows(plan, w); back.remove(); S.toast('Windows saved.'); drawAll();
        }
      })
    ]));
    panel.appendChild(bd); back.appendChild(panel);
    document.body.appendChild(back);
  }

  /* ---------- roster ---------- */
  function players() {
    var d = db(), out = [];
    Object.keys(d.players).forEach(function (k) { if (d.players[k].plan === plan) out.push(d.players[k]); });
    out.sort(function (a, b) {
      var pa = posIndex(a.position), pb = posIndex(b.position);
      return pa - pb || (a.name || '').localeCompare(b.name || '');
    });
    return out;
  }
  function posIndex(code) {
    var p = (window.CLUB.positions || []).map(function (x) { return x.code; });
    var i = p.indexOf(code);
    return i < 0 ? 99 : i;
  }
  function position(code) {
    return (window.CLUB.positions || []).filter(function (p) { return p.code === code; })[0] || null;
  }

  /* Club quarter legend: Q1 Aug-Oct, Q2 Nov-Jan, Q3 Feb-Apr, Q4 May-Jul */
  function qtrFromDOB(iso) {
    if (!iso) return '';
    var m = parseInt(iso.slice(5, 7), 10);
    if (m >= 8 && m <= 10) return 'Q1';
    if (m === 11 || m === 12 || m === 1) return 'Q2';
    if (m >= 2 && m <= 4) return 'Q3';
    return 'Q4';
  }

  function addPlayer() {
    var name = prompt('Player name or initials');
    if (!name) return;
    var d = db();
    var id = 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    d.players[id] = { id: id, plan: plan, name: name.trim(), position: '', secondary: '',
      number: '', dob: '', qtr: '', ageGroup: '', covers: [], ranks: {} };
    if (write(d)) { playerId = id; drawAll(); }
  }

  function renderRoster() {
    var host = document.getElementById('roster');
    host.innerHTML = '';
    var list = players();
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty', text: 'No players on ' + S.planLabel(plan) + ' yet. Add one to open a sheet.' }));
      return;
    }
    var ul = el('ul', { class: 'list' });
    list.forEach(function (p) {
      var num = el('input', { type: 'text', value: p.number || '', maxlength: 2, class: 'num', style: 'width:52px' });
      num.addEventListener('input', function () { var d = db(); d.players[p.id].number = num.value; write(d); });

      var nm = el('input', { type: 'text', value: p.name || '', style: 'min-width:150px' });
      nm.addEventListener('input', function () { var d = db(); d.players[p.id].name = nm.value; write(d); });

      var dob = el('input', { type: 'date', style: 'width:auto', title: 'Date of birth' });
      dob.value = p.dob || '';
      dob.addEventListener('change', function () {
        var d = db();
        d.players[p.id].dob = dob.value;
        d.players[p.id].qtr = qtrFromDOB(dob.value);
        write(d); drawAll();
      });

      function posSelect(key, blank) {
        var sel = el('select', { style: 'width:auto' });
        sel.appendChild(el('option', { value: '', text: blank }));
        (window.CLUB.positions || []).forEach(function (x) {
          sel.appendChild(el('option', { value: x.code, text: x.code + ' · ' + x.name }));
        });
        sel.value = p[key] || '';
        sel.addEventListener('change', function () {
          var d = db(); d.players[p.id][key] = sel.value; write(d); drawAll();
        });
        return sel;
      }
      var pos = posSelect('position', '- primary -');
      var pos2 = posSelect('secondary', '- secondary -');

      var counts = coverageFor(p);
      ul.appendChild(el('li', {}, [
        num, nm, dob,
        el('span', { class: 'chip', title: 'Birth quarter', text: p.qtr || 'Q-' }),
        pos, pos2,
        el('div', { class: 'grow' }, [
          el('div', { class: 'sub', text: counts.total ? counts.perWindow.map(function (c, i) {
            return windowsFor(plan)[i].label + ' ' + c;
          }).join(' · ') : 'no focus set yet' })
        ]),
        el('button', { class: 'btn ghost sm', text: 'Open sheet', onclick: function () { playerId = p.id; drawSheet(); document.getElementById('sheetTitle').scrollIntoView({ behavior: 'smooth', block: 'start' }); } }),
        el('button', {
          class: 'btn warn sm', text: 'Remove', onclick: function () {
            if (!confirm('Remove ' + (p.name || 'this player') + ' and their marks?')) return;
            var d = db();
            delete d.players[p.id];
            Object.keys(d.marks).forEach(function (k) { if (k.indexOf(p.id + '|') === 0) delete d.marks[k]; });
            write(d);
            if (playerId === p.id) playerId = '';
            drawAll();
          }
        })
      ]));
    });
    host.appendChild(ul);
  }

  /* ---------- criteria ----------
     The sheet ships with the club's criteria, but a coach has to be able to add
     what their team actually needs and drop what does not apply. Edits are held
     per position and survive everything. */
  var CK = 'ncfc.criteria.v1';
  function critEdits() { try { return JSON.parse(localStorage.getItem(CK) || '{}'); } catch (e) { return {}; } }
  function critSave(d) {
    try { localStorage.setItem(CK, JSON.stringify(d)); return true; }
    catch (e) { S.toast('Could not save.'); return false; }
  }
  function critKey(code, section) { return (code || 'ANY') + '|' + section; }

  /* ---------- the instrument ----------
     A3 §IDP Mapping is explicit: the club EVB form is the DESTINATION, not the
     instrument, because a third parallel scheme forces the monitoring to choose.
     A1 Appendix A is the instrument, so the sheet is built from it: the four
     benchmark categories against the principles and sub-principles, scored by
     tier with a direction. */
  function categories() {
    return (window.CLUB && window.CLUB.benchmarkCategories) ||
      ['Awareness', 'Perception', 'Execution', 'Adjustment'];
  }
  function targets() {
    var out = [];
    (window.PRINCIPLES || []).forEach(function (p) {
      out.push({ code: p.code, label: p.clubCode + '  ' + (p.clubName || p.name),
        moment: p.moment, cue: p.cue || '' });
      (window.Lists ? window.Lists.subsFor(p.code) : (p.subs || [])).forEach(function (sp) {
        out.push({ code: sp.code, label: '   ' + sp.code + '  ' + sp.text,
          moment: p.moment, cue: sp.cue || '', sub: true });
      });
    });
    return out;
  }
  /* ---------- targets ---------- */
  function tKey() { return 'ncfc.idptargets.v1'; }
  function tAll() { try { return JSON.parse(localStorage.getItem(tKey()) || '{}'); } catch (e) { return {}; } }
  function tFor(pid) { return (tAll()[pid] || []); }
  function tSave(pid, list) {
    var d = tAll(); d[pid] = list;
    try { localStorage.setItem(tKey(), JSON.stringify(d)); } catch (e) { S.toast('Could not save.'); }
  }

  function renderTargets() {
    var host = document.getElementById('targets');
    if (!host) return;
    host.innerHTML = '';
    var list = players();
    var p = list.filter(function (x) { return x.id === playerId; })[0];
    if (!p) { host.appendChild(el('div', { class: 'empty', text: 'Pick a player.' })); return; }
    var mine = tFor(p.id);
    if (!mine.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'No targets yet. A target is one benchmark category against one principle: ' +
          'Perception on IP.4, say, or Execution on TR11.4. Two or three at a time is plenty.' }));
    }
    var C = window.CLUB || {};
    var opts = targets();
    mine.forEach(function (t, i) {
      var row = el('div', { class: 'grid g5', style: 'margin-bottom:8px;align-items:end' });
      function sel(val, items, cb, blank) {
        var s2 = el('select');
        if (blank) s2.appendChild(el('option', { value: '', text: blank }));
        items.forEach(function (x) {
          var v = typeof x === 'object' ? x.code : x, lab = typeof x === 'object' ? x.label : x;
          s2.appendChild(el('option', { value: v, text: lab }));
        });
        s2.value = val || '';
        s2.addEventListener('change', function () { cb(s2.value); tSave(p.id, mine); renderTargets(); });
        return s2;
      }
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Category' }),
        sel(t.category, categories(), function (v) { t.category = v; }, '-')]));
      row.appendChild(el('label', { class: 'f span2' }, [el('span', { text: 'Principle' }),
        sel(t.target, opts, function (v) { t.target = v; }, '-')]));
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Tier now' }),
        sel(t.tier, C.tiers || [], function (v) { t.tier = v; }, '-')]));
      row.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Direction' }),
        sel(t.direction, C.directions || [], function (v) { t.direction = v; }, '-')]));
      host.appendChild(row);

      var o = opts.filter(function (x) { return x.code === t.target; })[0];
      var note = el('input', { type: 'text', value: t.note || '', placeholder: 'what has to change' });
      note.addEventListener('input', function () { t.note = note.value; tSave(p.id, mine); });
      host.appendChild(el('div', { class: 'btnrow', style: 'margin:-2px 0 14px' }, [
        o && o.cue ? el('span', { class: 'chip', text: 'cue: ' + o.cue }) : null,
        o ? el('span', { class: 'chip ' + S.momentKey(o.moment), text: o.moment }) : null,
        note,
        el('button', { class: 'btn warn sm', text: 'Remove',
          onclick: function () { mine.splice(i, 1); tSave(p.id, mine); renderTargets(); } })
      ]));
    });
  }

  function criteria(code) {
    var p = position(code);
    var base = [{ section: 'UNIVERSAL', items: (window.CLUB.universal || []).slice() }];
    if (p) base = base.concat(p.sections.map(function (g) {
      return { section: g.section, items: (g.items || []).slice() };
    }));
    var ed = critEdits();
    base.forEach(function (g) {
      var e = ed[critKey(code, g.section)] || {};
      var hide = e.hide || [];
      g.items = g.items.filter(function (x) { return hide.indexOf(x) < 0; });
      (e.add || []).forEach(function (x) { if (g.items.indexOf(x) < 0) g.items.push(x); });
    });
    /* whole sections a coach has added for this position */
    Object.keys(ed).forEach(function (k) {
      if (k.indexOf((code || 'ANY') + '|') !== 0) return;
      var sec = k.slice(k.indexOf('|') + 1);
      if (base.some(function (g) { return g.section === sec; })) return;
      var e = ed[k];
      if ((e.add || []).length) base.push({ section: sec, items: e.add.slice(), mine: true });
    });
    return base.filter(function (g) { return g.items.length; });
  }
  function critAdd(code, section, text) {
    text = (text || '').trim();
    if (!text) return false;
    var d = critEdits(), k = critKey(code, section);
    d[k] = d[k] || { add: [], hide: [] };
    d[k].hide = (d[k].hide || []).filter(function (x) { return x !== text; });
    if ((d[k].add || []).indexOf(text) < 0) (d[k].add = d[k].add || []).push(text);
    return critSave(d);
  }
  function critRemove(code, section, text) {
    var d = critEdits(), k = critKey(code, section);
    d[k] = d[k] || { add: [], hide: [] };
    d[k].add = (d[k].add || []).filter(function (x) { return x !== text; });
    d[k].hide = d[k].hide || [];
    if (d[k].hide.indexOf(text) < 0) d[k].hide.push(text);
    return critSave(d);
  }
  function critShipped(code, section, text) {
    var p = position(code);
    if (section === 'UNIVERSAL') return (window.CLUB.universal || []).indexOf(text) >= 0;
    if (!p) return false;
    var g = p.sections.filter(function (x) { return x.section === section; })[0];
    return !!(g && g.items.indexOf(text) >= 0);
  }
  function critReset(code) {
    var d = critEdits();
    Object.keys(d).forEach(function (k) { if (k.indexOf((code || 'ANY') + '|') === 0) delete d[k]; });
    critSave(d);
  }
  function key(pid, section, text, wi) {
    return pid + '|' + section + '|' + text.slice(0, 60) + '|' + wi;
  }
  function mark(pid, section, text, wi) {
    return db().marks[key(pid, section, text, wi)] || {};
  }
  function setMark(pid, section, text, wi, patch) {
    var d = db(), k = key(pid, section, text, wi);
    d.marks[k] = Object.assign({}, d.marks[k] || {}, patch);
    if (!d.marks[k].focus && !d.marks[k].tier && !d.marks[k].note) delete d.marks[k];
    write(d);
  }

  function coverageFor(p) {
    var wins = windowsFor(plan);
    var per = wins.map(function () { return 0; });
    var total = 0;
    if (p.position) {
      criteria(p.position).forEach(function (g) {
        g.items.forEach(function (t) {
          wins.forEach(function (_, wi) {
            if (mark(p.id, g.section, t, wi).focus) { per[wi]++; total++; }
          });
        });
      });
    }
    return { perWindow: per, total: total };
  }

  /* ---------- sheet ---------- */
  function drawSheet() {
    var host = document.getElementById('sheet');
    var sel = document.getElementById('playerSel');
    var list = players();

    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '', text: '- choose a player -' }));
    list.forEach(function (p) {
      sel.appendChild(el('option', { value: p.id, text: (p.number ? p.number + ' ' : '') + p.name + (p.position ? ' · ' + p.position : '') }));
    });
    if (!list.some(function (p) { return p.id === playerId; })) playerId = list.length ? list[0].id : '';
    sel.value = playerId;
    sel.onchange = function () { playerId = sel.value; drawSheet(); };

    host.innerHTML = '';
    var p = list.filter(function (x) { return x.id === playerId; })[0];
    var strip = document.getElementById('strength');
    if (strip) strip.innerHTML = '';
    if (!p) {
      document.getElementById('sheetTitle').textContent = 'Sheet';
      host.appendChild(el('div', { class: 'empty', text: 'Add a player, then set a position.' }));
      return;
    }
    if (!p.position) {
      document.getElementById('sheetTitle').textContent = p.name;
      host.appendChild(el('div', { class: 'empty', text: 'Set a position for ' + p.name + ' to load a sheet.' }));
      return;
    }

    var pos = position(p.position);
    document.getElementById('sheetTitle').textContent = p.name + ' · ' + pos.code + ' ' + pos.name;

    var wins = windowsFor(plan);
    renderStrength(p, wins);
    var scroll = el('div', { class: 'tbl-scroll' });
    var tbl = el('table', { class: 'grid-t fixed', style: 'min-width:' + (330 + wins.length * 150 + 278) + 'px' });

    // explicit widths, so a long criterion can never push into a dropdown
    var cg = el('colgroup');
    cg.appendChild(el('col', { style: 'width:330px' }));
    wins.forEach(function () { cg.appendChild(el('col', { style: 'width:150px' })); });
    cg.appendChild(el('col', { style: 'width:78px' }));
    cg.appendChild(el('col', { style: 'width:200px' }));
    tbl.appendChild(cg);

    var hr = el('tr', {}, [el('th', { class: 'prose', text: 'Criterion' })]);
    wins.forEach(function (w) {
      hr.appendChild(el('th', { html: esc(w.label) + (w.date ? '<br><span style="opacity:.7">' + esc(S.fmt(w.date)) + '</span>' : '') }));
    });
    hr.appendChild(el('th', { text: 'Trend' }));
    hr.appendChild(el('th', { text: 'Notes' }));
    tbl.appendChild(el('thead', {}, [hr]));

    var body = el('tbody');
    criteria(p.position).forEach(function (g) {
      var hdCell = el('td', { colspan: wins.length + 2, class: 'prose' });
      hdCell.appendChild(el('span', { text: g.section }));
      hdCell.appendChild(el('span', { class: 'rt',
        text: g.mine ? 'yours'
          : (g.section === 'UNIVERSAL' ? 'applies to every position'
            : pos.code + ' \u00b7 ' + (pos.source === 'EVB' ? 'club EVB' : 'built from the role profile')) }));
      hdCell.appendChild(el('button', {
        class: 'btn ghost sm no-print', style: 'margin-left:10px;padding:1px 8px', text: '+ criterion',
        title: 'Add a criterion to ' + g.section + ' for every ' + (p.position || 'player'),
        onclick: function () {
          var t2 = prompt('New criterion under ' + g.section);
          if (!t2) return;
          critAdd(p.position, g.section, t2);
          drawSheet(); renderCoverage();
          S.toast('Added for every ' + (p.position || 'player') + '.');
        }
      }));
      body.appendChild(el('tr', { class: 'wkband' }, [hdCell]));

      g.items.forEach(function (t) {
        var tr = el('tr');
        var lab = el('td', { class: 'prose', style: 'font-size:12.5px;line-height:1.35' });
        lab.appendChild(el('span', { text: t }));
        lab.appendChild(el('button', {
          class: 'rmx no-print', type: 'button', text: '\u2715',
          title: critShipped(p.position, g.section, t) ? 'Hide this criterion' : 'Delete this, it is yours',
          onclick: function () {
            var own = !critShipped(p.position, g.section, t);
            if (!confirm((own ? 'Delete' : 'Hide') + ' this criterion?\n\n' + t +
              '\n\nAny marks already made against it are kept, and come back if you restore it.')) return;
            critRemove(p.position, g.section, t);
            drawSheet(); renderCoverage();
          }
        }));
        tr.appendChild(lab);
        wins.forEach(function (_, wi) {
          var m = mark(p.id, g.section, t, wi);
          var cell = el('div', { class: 'markcell' });

          var star = el('button', {
            type: 'button', class: 'focusbtn' + (m.focus ? ' on' : ''),
            title: 'IDP focus for this window', text: m.focus ? '\u2605' : '\u2606'
          });
          star.addEventListener('click', function () {
            var now = !mark(p.id, g.section, t, wi).focus;
            setMark(p.id, g.section, t, wi, { focus: now });
            star.className = 'focusbtn' + (now ? ' on' : '');
            star.textContent = now ? '\u2605' : '\u2606';
            renderRoster(); renderCoverage();
          });
          cell.appendChild(star);

          var lights = el('div', { class: 'lights' });
          TIERS.forEach(function (x) {
            var b = el('button', {
              type: 'button', class: 'light ' + x.dot + ((m.tier === x.v) ? ' on' : ''),
              title: x.title, 'aria-label': x.v
            });
            b.addEventListener('click', function () {
              var cur = mark(p.id, g.section, t, wi).tier;
              var next = cur === x.v ? '' : x.v;
              setMark(p.id, g.section, t, wi, { tier: next });
              drawSheet(); renderCoverage();
            });
            lights.appendChild(b);
          });
          cell.appendChild(lights);
          tr.appendChild(el('td', {}, [cell]));
        });

        tr.appendChild(el('td', {}, [trendCell(p, g.section, t, wins)]));
        var note = el('input', { type: 'text', style: 'padding:4px 6px;font-size:12px' });
        note.value = mark(p.id, g.section, t, 0).note || '';
        var to;
        note.addEventListener('input', function () {
          clearTimeout(to);
          to = setTimeout(function () { setMark(p.id, g.section, t, 0, { note: note.value }); }, 350);
        });
        tr.appendChild(el('td', {}, [note]));
        body.appendChild(tr);
      });
    });
    tbl.appendChild(body);
    scroll.appendChild(tbl);
    host.appendChild(scroll);

    if (pos.source !== 'EVB') {
      host.appendChild(el('p', {
        class: 'hint', style: 'padding:12px 16px;margin:0',
        text: 'The EVB workbook has no goalkeeper sheet. These criteria are built from your GK role profile and are marked as such wherever they are exported.'
      }));
    }
  }

  /* ---------- trend ----------
     Compares the first and last window that carry a tier. Two ratings are
     needed before anything is claimed; one is a reading, not a direction. */
  function series(p, section, t, wins) {
    var out = [];
    wins.forEach(function (_, wi) {
      var m = mark(p.id, section, t, wi);
      if (m.tier) out.push({ wi: wi, r: TIER_RANK[m.tier], tier: m.tier });
    });
    return out;
  }
  function trendOf(p, section, t, wins) {
    var s = series(p, section, t, wins);
    if (s.length < 2) return { dir: 0, label: s.length ? 'first reading' : '', cur: s.length ? s[0].tier : '' };
    var d = s[s.length - 1].r - s[0].r;
    return {
      dir: d > 0 ? 1 : (d < 0 ? -1 : 0),
      label: d > 0 ? 'up ' + d : (d < 0 ? 'down ' + (-d) : 'holding'),
      cur: s[s.length - 1].tier
    };
  }
  function trendCell(p, section, t, wins) {
    var tr = trendOf(p, section, t, wins);
    if (!tr.label) return el('span', { class: 'hint', style: 'font-size:11px', text: '-' });
    var arrow = tr.dir > 0 ? '\u2191' : (tr.dir < 0 ? '\u2193' : '\u2192');
    var cls = tr.dir > 0 ? 'ao' : (tr.dir < 0 ? 'dt' : '');
    return el('span', { class: 'chip ' + cls, title: tr.label, text: tr.label === 'first reading' ? '\u00b7' : arrow + ' ' + tr.label });
  }

  /* strongest and most-improved right now, across every criterion */
  function strengths(p, wins) {
    var adv = [], up = [], down = [];
    if (!p.position) return { adv: adv, up: up, down: down };
    criteria(p.position).forEach(function (g) {
      g.items.forEach(function (t) {
        var tr = trendOf(p, g.section, t, wins);
        if (tr.cur === 'Advanced') adv.push(t);
        if (tr.dir > 0) up.push(t);
        if (tr.dir < 0) down.push(t);
      });
    });
    return { adv: adv, up: up, down: down };
  }

  /* ---------- coverage ---------- */
  function renderCoverage() {
    var host = document.getElementById('coverage');
    host.innerHTML = '';
    var list = players();
    var wins = windowsFor(plan);

    if (!list.length) {
      host.appendChild(el('div', { class: 'empty', text: 'Nothing to count yet.' }));
      return;
    }

    var tbl = el('table', { class: 'grid-t' });
    var hr = el('tr', {}, [el('th', { text: 'Player' }), el('th', { text: 'Position' })]);
    wins.forEach(function (w) { hr.appendChild(el('th', { text: w.label })); });
    hr.appendChild(el('th', { text: 'Total focus' }));
    tbl.appendChild(el('thead', {}, [hr]));

    var body = el('tbody');
    list.forEach(function (p) {
      var c = coverageFor(p);
      var tr = el('tr');
      tr.appendChild(el('td', { text: (p.number ? p.number + ' ' : '') + p.name }));
      tr.appendChild(el('td', {}, [p.position
        ? el('span', { class: 'chip', text: p.position })
        : el('span', { class: 'chip off', text: 'unset' })]));
      c.perWindow.forEach(function (n) {
        tr.appendChild(el('td', {}, [n
          ? el('span', { class: 'chip ao', text: String(n) })
          : el('span', { class: 'chip off', text: '0' })]));
      });
      tr.appendChild(el('td', { text: String(c.total) }));
      body.appendChild(tr);
    });
    tbl.appendChild(body);
    host.appendChild(tbl);

    var covered = {};
    list.forEach(function (p) { if (p.position) covered[p.position] = (covered[p.position] || 0) + 1; });
    var missing = (window.CLUB.positions || []).filter(function (x) { return !covered[x.code]; });
    if (missing.length) {
      host.appendChild(el('p', {
        class: 'hint', style: 'margin-top:12px',
        text: 'No player assigned to: ' + missing.map(function (m) { return m.code; }).join(', ') + '.'
      }));
    }
    var unset = list.filter(function (p) { return !p.position; }).length;
    if (unset) host.appendChild(el('p', { class: 'hint', style: 'margin-top:6px', text: unset + ' player(s) still have no position.' }));
  }

  function renderStrength(p, wins) {
    var strip = document.getElementById('strength');
    if (!strip) return;
    var st = strengths(p, wins);
    strip.innerHTML = '';
    if (!st.adv.length && !st.up.length && !st.down.length) {
      strip.appendChild(el('p', { class: 'hint', style: 'margin:0',
        text: 'Rate the same criterion in two windows and the direction of travel appears here.' }));
      return;
    }
    function row(title, items, cls) {
      if (!items.length) return;
      var box = el('div', { style: 'margin-bottom:10px' });
      box.appendChild(el('span', { class: 'chip ' + cls, text: title + ' ' + items.length }));
      box.appendChild(el('span', { class: 'hint', style: 'margin-left:8px',
        text: items.slice(0, 4).join(' · ') + (items.length > 4 ? ' and ' + (items.length - 4) + ' more' : '') }));
      strip.appendChild(box);
    }
    row('Advanced now', st.adv, 'ao');
    row('Trending up', st.up, 'ao');
    row('Trending down', st.down, 'dt');
  }

  /* ---------- export ---------- */
  function csv() {
    var wins = windowsFor(plan);
    var head = ['Squad', 'Player', 'Number', 'DOB', 'Qtr', 'Primary', 'Secondary', 'Source', 'Section', 'Criterion'];
    wins.forEach(function (w) { head.push(w.label + ' focus'); head.push(w.label + ' tier'); });
    head.push('Trend'); head.push('Notes');
    var rows = [head];
    players().forEach(function (p) {
      if (!p.position) return;
      var pos = position(p.position);
      criteria(p.position).forEach(function (g) {
        g.items.forEach(function (t) {
          var r = [S.planLabel(plan), p.name, p.number || '', p.dob || '', p.qtr || '',
            p.position, p.secondary || '',
            g.section === 'UNIVERSAL' ? 'EVB universal' : (pos.source === 'EVB' ? 'EVB' : 'Role profile'),
            g.section, t];
          wins.forEach(function (_, wi) {
            var m = mark(p.id, g.section, t, wi);
            r.push(m.focus ? 'x' : ''); r.push(m.tier || '');
          });
          r.push(trendOf(p, g.section, t, wins).label || '');
          r.push(mark(p.id, g.section, t, 0).note || '');
          rows.push(r);
        });
      });
    });
    if (rows.length === 1) { S.toast('Nothing to export. Give a player a position first.'); return; }
    S.download('IDP_' + S.planLabel(plan).replace(/[^\w-]+/g, '_') + '.csv', S.toCSV(rows), 'text/csv');
  }

  function buildPrint() {
    var list = players().filter(function (p) { return p.position; });
    var wins = windowsFor(plan);
    var html = '';
    list.forEach(function (p) {
      var pos = position(p.position);
      html += '<div style="page-break-after:always">' +
        '<h1 style="margin:0 0 2pt;font-size:16pt">' + esc(p.name) + (p.number ? ' · ' + esc(p.number) : '') + '</h1>' +
        '<p style="margin:0 0 10pt;font-size:10pt">' + esc(pos.code + ' ' + pos.name + ' · ' + S.planLabel(plan)) + '</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:8.5pt">' +
        '<tr><th style="text-align:left;border-bottom:1.5pt solid #143250;padding:3pt">Criterion</th>' +
        wins.map(function (w) { return '<th style="border-bottom:1.5pt solid #143250;padding:3pt;width:14mm">' + esc(w.label) + '</th>'; }).join('') +
        '</tr>';
      criteria(p.position).forEach(function (g) {
        html += '<tr><td colspan="' + (wins.length + 1) + '" style="background:#143250;color:#fff;padding:2pt 3pt;font-weight:600">' + esc(g.section) + '</td></tr>';
        g.items.forEach(function (t) {
          html += '<tr><td style="padding:2pt 3pt;border-bottom:.5pt solid #ccc">' + esc(t) + '</td>' +
            wins.map(function (_, wi) {
              var m = mark(p.id, g.section, t, wi);
              return '<td style="padding:2pt 3pt;border-bottom:.5pt solid #ccc;text-align:center">' +
                (m.focus ? 'x' : '') + (m.tier ? ' ' + TIER_SHORT[m.tier] : '') + '</td>';
            }).join('') + '</tr>';
        });
      });
      html += '</table></div>';
    });
    document.getElementById('printOnly').innerHTML = html || '<p>No players with a position set.</p>';
    document.body.classList.add('has-printsheet');
  }

  /* ---------- init ---------- */
  function drawAll() { renderRoster(); renderCoverage(); drawSheet(); }

  document.addEventListener('DOMContentLoaded', function () {
    var ps = document.getElementById('planSel');
    S.planList().forEach(function (p) { ps.appendChild(el('option', { value: p.id, text: p.short })); });
    ps.value = plan;
    ps.addEventListener('change', function () { plan = ps.value; S.setPref('squad', plan); playerId = ''; drawAll(); });

    document.getElementById('btnAdd').addEventListener('click', addPlayer);
    document.getElementById('btnWindows').addEventListener('click', editWindows);
    var ac = document.getElementById('btnAddSection');
    if (ac) ac.addEventListener('click', function () {
      var list = players();
      var pl = list.filter(function (x) { return x.id === playerId; })[0];
      if (!pl || !pl.position) { S.toast('Choose a player with a position first.'); return; }
      var sec = prompt('Name a new section for ' + pl.position + ', for example SET PLAYS');
      if (!sec) return;
      var first = prompt('First criterion under ' + sec.toUpperCase());
      if (!first) return;
      critAdd(pl.position, sec.toUpperCase().trim(), first);
      drawSheet(); renderCoverage();
      S.toast(sec.toUpperCase() + ' added for every ' + pl.position + '.');
    });
    var at = document.getElementById('btnAddTarget');
    if (at) at.addEventListener('click', function () {
      var list = players();
      var p = list.filter(function (x) { return x.id === playerId; })[0];
      if (!p) { S.toast('Pick a player first.'); return; }
      var mine = tFor(p.id).slice();
      mine.push({ category: '', target: '', tier: '', direction: '', note: '' });
      tSave(p.id, mine); renderTargets();
    });
    var rc = document.getElementById('btnResetCrit');
    if (rc) rc.addEventListener('click', function () {
      var list = players();
      var p = list.filter(function (x) { return x.id === playerId; })[0];
      if (!p || !p.position) { S.toast('Choose a player with a position first.'); return; }
      if (!confirm('Reset the ' + p.position + ' criteria to what the club issued?\n\nYour additions to this position go; marks are kept.')) return;
      critReset(p.position);
      drawSheet(); renderCoverage();
      S.toast(p.position + ' criteria reset.');
    });
    document.getElementById('btnCsv').addEventListener('click', csv);
    document.getElementById('btnPrint').addEventListener('click', function () { buildPrint(); window.print(); });
    window.addEventListener('beforeprint', buildPrint);

    drawAll();
  });
})();

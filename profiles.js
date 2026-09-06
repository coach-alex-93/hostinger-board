/* ============================================================
   profiles.js — role responsibilities, editable end to end
   Every line can be edited, moved, deleted or added. Any line can
   be marked as a target you are coaching, given a KPI, and sent
   into a session as the team focus.
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, K = window.KPI, el = S.el, esc = S.esc;
  /* the editor lives inside the game model page, where the ids are prefixed so
     they cannot collide with the model's own Reset and Export */
  var EMBED = null;
  function id(name) {
    if (EMBED === null) EMBED = !!document.getElementById('pf_posSel');
    if (name === 'printOnly' || name === 'saveState') return document.getElementById(name);
    return document.getElementById((EMBED ? 'pf_' : '') + name);
  }
  function bind(name, ev, fn) {
    var n = id(name);
    if (n) n.addEventListener(ev, fn);
  }
  var KEY = 'ncfc.profiles.v1';
  var MOMENTS = ['Attacking Organization', 'Defensive Organization', 'Attacking Transition', 'Defensive Transition'];
  var code = '';

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { S.toast('Could not save.'); return false; }
  }
  /* shipped profiles are the starting point; once edited, yours are what load */
  function all() {
    var mine = read();
    if (mine) return mine;
    return JSON.parse(JSON.stringify(window.PROFILES || []));
  }
  function save(list) { if (write(list)) { id('saveState').textContent = 'Saved'; } }
  function get(c) { return all().filter(function (p) { return p.code === c; })[0] || null; }
  function put(p) {
    var list = all();
    var i = list.findIndex(function (x) { return x.code === p.code; });
    if (i < 0) list.push(p); else list[i] = p;
    save(list);
  }

  /* ---------- grid ---------- */
  function render() {
    var p = get(code);
    var host = id('grid');
    host.innerHTML = '';
    if (!p) { host.appendChild(el('div', { class: 'empty', text: 'Pick a position.' })); return; }

    var pt = id('posTitle');
    if (pt) pt.textContent = p.code + ' \u00b7 ' + p.name;
    var meta = id('posMeta');
    if (!meta) return;
    meta.innerHTML = '';
    meta.appendChild(el('span', { text: 'Shirt ' + (p.numbers || '-') + ' \u00b7 ' + (p.source || 'yours') }));
    if (p.check) meta.appendChild(el('span', { class: 'chip flag', style: 'margin-left:8px',
      text: 'transition rows inferred, check them' }));

    var wrap = el('div', { class: 'profgrid' });
    MOMENTS.forEach(function (m) {
      var col = el('div', { class: 'profcol' });
      col.appendChild(el('div', { class: 'profhd' }, [
        el('span', { class: 'chip ' + S.momentKey(m), text: m })
      ]));
      var items = (p.moments[m] = p.moments[m] || []);
      items.forEach(function (txtv, i) {
        var row = el('div', { class: 'profrow' + (isTarget(p.code, m, txtv) ? ' target' : '') });
        var ta = el('textarea', { rows: 3 });
        ta.value = txtv;
        var t;
        ta.addEventListener('input', function () {
          clearTimeout(t);
          t = setTimeout(function () {
            var old = items[i];
            items[i] = ta.value;
            retarget(p.code, m, old, ta.value);
            put(p);
          }, 350);
        });
        row.appendChild(ta);
        row.appendChild(el('div', { class: 'profacts no-print' }, [
          el('button', { class: 'btn ghost sm', title: 'Coach this', text: isTarget(p.code, m, txtv) ? '\u2605 target' : '\u2606 target',
            onclick: function () { toggleTarget(p.code, m, items[i]); render(); drawTargets(); } }),
          el('button', { class: 'btn ghost sm', title: 'Measure this', text: 'KPI',
            onclick: function () { makeKPI(p, m, items[i]); } }),
          el('button', { class: 'btn ghost sm', title: 'Plan a session on it', text: 'Session',
            onclick: function () {
              location.href = 'planner.html?focus=' + encodeURIComponent(items[i]);
            } }),
          el('button', { class: 'btn ghost sm', text: '\u2191',
            onclick: function () { if (i > 0) { items.splice(i - 1, 0, items.splice(i, 1)[0]); put(p); render(); } } }),
          el('button', { class: 'btn ghost sm', text: '\u2193',
            onclick: function () { if (i < items.length - 1) { items.splice(i + 1, 0, items.splice(i, 1)[0]); put(p); render(); } } }),
          el('button', { class: 'btn warn sm', text: 'Delete',
            onclick: function () {
              if (!confirm('Delete this responsibility?')) return;
              items.splice(i, 1); put(p); render(); drawTargets();
            } })
        ]));
        col.appendChild(row);
      });
      col.appendChild(el('button', {
        class: 'btn ghost sm no-print', style: 'margin-top:6px;width:100%;justify-content:center',
        text: '+ Add a responsibility',
        onclick: function () { items.push(''); put(p); render(); }
      }));
      wrap.appendChild(col);
    });
    host.appendChild(wrap);
  }

  /* ---------- targets ---------- */
  function targets() { try { return JSON.parse(localStorage.getItem('ncfc.targets.v1') || '{}'); } catch (e) { return {}; } }
  function tkey(c, m, t) { return c + '|' + m + '|' + (t || '').slice(0, 60); }
  function isTarget(c, m, t) { return !!targets()[tkey(c, m, t)]; }
  function toggleTarget(c, m, t) {
    var d = targets(), k = tkey(c, m, t);
    if (d[k]) delete d[k]; else d[k] = { code: c, moment: m, text: t, since: S.todayISO() };
    localStorage.setItem('ncfc.targets.v1', JSON.stringify(d));
  }
  function retarget(c, m, oldT, newT) {
    var d = targets(), k = tkey(c, m, oldT);
    if (!d[k]) return;
    var v = d[k]; delete d[k];
    v.text = newT; d[tkey(c, m, newT)] = v;
    localStorage.setItem('ncfc.targets.v1', JSON.stringify(d));
  }

  function drawTargets() {
    var host = id('targets');
    host.innerHTML = '';
    var d = targets();
    var mine = Object.keys(d).map(function (k) { return d[k]; })
      .filter(function (x) { return x.code === code; });
    if (!mine.length) {
      host.appendChild(el('div', { class: 'empty', text: 'Nothing marked yet. Star a responsibility above to make it something you are coaching.' }));
      return;
    }
    var ul = el('ul', { class: 'list' });
    mine.forEach(function (x) {
      var kpis = (K ? K.all() : []).filter(function (kp) { return kp.profileRef === tkey(x.code, x.moment, x.text); });
      ul.appendChild(el('li', {}, [
        el('span', { class: 'chip ' + S.momentKey(x.moment), text: x.moment.split(' ')[0] }),
        el('div', { class: 'grow' }, [
          el('div', { class: 'ttl', text: x.text }),
          el('div', { class: 'sub', text: 'target since ' + S.fmt(x.since) +
            (kpis.length ? ' \u00b7 measured by ' + kpis.map(function (k2) { return k2.category; }).join(', ') : ' \u00b7 no KPI attached') })
        ]),
        el('a', { class: 'btn ghost sm', href: 'planner.html?focus=' + encodeURIComponent(x.text), text: 'Plan it' }),
        el('a', { class: 'btn ghost sm', href: 'kpi.html', text: 'KPIs' })
      ]));
    });
    host.appendChild(ul);
  }

  function makeKPI(p, m, text) {
    if (!K) return;
    var cat = prompt('KPI category for this responsibility', text.slice(0, 60));
    if (!cat) return;
    K.save({
      id: null, category: cat, description: p.code + ' \u00b7 ' + m + ' \u00b7 ' + text,
      principle: '', unit: 'rate', profileRef: tkey(p.code, m, text)
    });
    if (!isTarget(p.code, m, text)) toggleTarget(p.code, m, text);
    S.toast('KPI created. Set its target on a session.');
    render(); drawTargets();
  }

  /* ---------- players ---------- */
  function players() {
    var host = id('players');
    host.innerHTML = '';
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    var list = Object.keys(d.players || {}).map(function (k) { return d.players[k]; })
      .filter(function (x) { return x.position === code || x.secondary === code || (x.covers || []).indexOf(code) >= 0; });
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'Nobody on the roster covers ' + code + '. ' }),
        el('a', { href: 'idp.html', text: 'Add players' })
      ]));
      return;
    }
    var ul = el('ul', { class: 'list' });
    list.forEach(function (pl) {
      var role = pl.position === code ? 'Primary' : (pl.secondary === code ? 'Secondary' : 'Covers');
      var focus = 0;
      Object.keys(d.marks || {}).forEach(function (k) { if (k.indexOf(pl.id + '|') === 0 && d.marks[k].focus) focus++; });
      ul.appendChild(el('li', {}, [
        el('span', { class: 'chip ' + (role === 'Primary' ? 'ao' : (role === 'Secondary' ? 'at' : '')), text: role }),
        el('div', { class: 'grow' }, [
          el('div', { class: 'ttl', text: (pl.number ? pl.number + ' ' : '') + pl.name }),
          el('div', { class: 'sub', text: focus ? focus + ' IDP focus criteria set' : 'no IDP focus set yet' })
        ]),
        el('a', { class: 'btn ghost sm', href: 'idp.html', text: 'IDP sheet' })
      ]));
    });
    host.appendChild(ul);
  }

  /* ---------- export ---------- */
  function csv() {
    var rows = [['Position', 'Shirt', 'Moment', 'Responsibility', 'Coaching target', 'KPI attached']];
    all().forEach(function (p) {
      MOMENTS.forEach(function (m) {
        (p.moments[m] || []).forEach(function (t) {
          var kp = (K ? K.all() : []).filter(function (k2) { return k2.profileRef === tkey(p.code, m, t); });
          rows.push([p.code, p.numbers || '', m, t, isTarget(p.code, m, t) ? 'Yes' : '',
            kp.map(function (k2) { return k2.category; }).join('; ')]);
        });
      });
    });
    S.exportAs('Role_profiles', rows);
  }
  function buildPrint() {
    var html = '';
    all().forEach(function (p) {
      html += '<div style="page-break-inside:avoid;margin-bottom:10pt">' +
        '<h2 style="margin:0 0 3pt;font-size:13pt">' + esc(p.code + ' \u00b7 ' + p.name) + ' &nbsp;<span style="font-size:9pt;font-weight:400">#' + esc(p.numbers || '') + '</span></h2>' +
        '<table style="width:100%;border-collapse:collapse;font-size:8.5pt"><tr>' +
        MOMENTS.map(function (m) { return '<th style="text-align:left;padding:3pt;border:.5pt solid #999;background:#143250;color:#fff;width:25%">' + esc(m) + '</th>'; }).join('') +
        '</tr><tr>' + MOMENTS.map(function (m) {
          return '<td style="padding:3pt;border:.5pt solid #999;vertical-align:top">' +
            ((p.moments[m] || []).map(function (t) {
              return '<p style="margin:0 0 3pt">' + (isTarget(p.code, m, t) ? '&#9733; ' : '') + esc(t) + '</p>';
            }).join('') || '-') + '</td>';
        }).join('') + '</tr></table></div>';
    });
    id('printOnly').innerHTML = html;
    document.body.classList.add('has-printsheet');
  }

  /* ---------- init ---------- */
  function fillPos() {
    var sel = id('posSel');
    sel.innerHTML = '';
    all().forEach(function (p) { sel.appendChild(el('option', { value: p.code, text: p.code + ' \u00b7 ' + p.name })); });
    if (!all().some(function (p) { return p.code === code; })) code = (all()[0] || {}).code || '';
    sel.value = code;
  }
  function draw() { fillPos(); render(); drawTargets(); players(); }

  document.addEventListener('DOMContentLoaded', function () {
    if (!id('posSel')) return;                 // page without the profiles block
    var q = new URLSearchParams(location.search);
    code = q.get('pos') || (all()[0] || {}).code || '';
    bind('posSel', 'change', function () { code = this.value; draw(); });
    bind('btnAddPos', 'click', function () {
      var c = prompt('Position code, for example RWB');
      if (!c) return;
      var n = prompt('Position name', c) || c;
      var list = all();
      list.push({ code: c.trim(), name: n.trim(), numbers: '', source: 'yours',
        moments: { 'Attacking Organization': [], 'Defensive Organization': [], 'Attacking Transition': [], 'Defensive Transition': [] } });
      save(list); code = c.trim(); draw();
    });
    bind('btnReset', 'click', function () {
      if (!confirm('Reset every profile to what the game model says? Your edits are lost. Targets and KPIs stay.')) return;
      localStorage.removeItem(KEY); draw(); S.toast('Reset to the game model.');
    });
    bind('btnCsv', 'click', csv);
    bind('btnPrint', 'click', function () { buildPrint(); window.print(); });
    window.addEventListener('beforeprint', buildPrint);
    draw();
  });
})();

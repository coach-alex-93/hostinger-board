/* kpi-page.js — KPI library and the field tally sheet */
(function () {
  'use strict';
  var S = window.Store, K = window.KPI, el = S.el, esc = S.esc;
  var sessionId = '', sess = null, attributeTo = '';

  /* ---------- tally ---------- */
  function roster() {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    var out = [];
    Object.keys(d.players || {}).forEach(function (k) {
      if (!sess || d.players[k].plan === sess.squad) out.push(d.players[k]);
    });
    out.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
    return out;
  }

  function tallyFor(id) {
    sess.kpis = sess.kpis || [];
    var t = sess.kpis.filter(function (x) { return x.id === id; })[0];
    if (!t) { t = K.blankTally(id); sess.kpis.push(t); }
    t.players = t.players || {};
    return t;
  }
  function bump(id, field, delta) {
    var t = tallyFor(id);
    t[field] = Math.max(0, (t[field] || 0) + delta);
    if (field === 'succ' && delta > 0 && t.succ > t.opps) t.opps = t.succ;
    if (attributeTo) {
      var p = t.players[attributeTo] || { opps: 0, succ: 0 };
      p[field] = Math.max(0, (p[field] || 0) + delta);
      t.players[attributeTo] = p;
    }
    S.saveSession(sess);
    drawTally(); trend(); players();
  }

  function drawTally() {
    var host = document.getElementById('tally');
    host.innerHTML = '';
    var meta = document.getElementById('tallyMeta');
    if (!sess) {
      meta.textContent = '';
      host.appendChild(el('div', { class: 'empty', text: 'Write a session first, then pick it here.' }));
      return;
    }
    var p = S.principle(sess.principleCode);
    meta.textContent = [S.planLabel(sess.squad), p ? '[' + p.clubCode + ']' : '', sess.location].filter(Boolean).join(' · ');

    var chosen = (sess.kpis || []).filter(function (t) { return K.get(t.id); });
    if (!chosen.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'No KPIs on this session yet. Pick them in ' }),
        el('a', { href: 'planner.html?id=' + encodeURIComponent(sess.id), text: 'the plan' }),
        el('span', { text: ', under Success criteria.' })
      ]));
      return;
    }

    chosen.forEach(function (t) {
      var def = K.get(t.id);
      var card = el('div', { class: 'tallycard' });
      var m = K.met(t, def.unit);
      var tl = K.targetLabel(t, def.unit);
      card.appendChild(el('div', { class: 'tally-hd' }, [
        el('b', { text: def.category }),
        el('span', { class: 'chip ' + (m === null ? 'off' : (m ? 'ao' : 'dt')),
          text: tl ? 'target ' + tl : 'no target' })
      ]));
      card.appendChild(el('div', { class: 'tally-now', text: K.fmtActual(t, def.unit) }));

      var rows = el('div', { class: 'tally-rows' });
      [['opps', 'Opportunity'], ['succ', 'Success']].forEach(function (f) {
        rows.appendChild(el('div', { class: 'tally-row' }, [
          el('button', { class: 'tbtn minus', type: 'button', text: '\u2212',
            onclick: function () { bump(t.id, f[0], -1); } }),
          el('div', { class: 'tlab' }, [
            el('span', { text: f[1] }),
            el('b', { text: String(t[f[0]] || 0) })
          ]),
          el('button', { class: 'tbtn plus', type: 'button', text: '+',
            onclick: function () { bump(t.id, f[0], 1); } })
        ]));
      });
      card.appendChild(rows);

      var rows = K.playerRows(t);
      if (rows.length) {
        var who = roster();
        var name = function (id) {
          var p2 = who.filter(function (x) { return x.id === id; })[0];
          return p2 ? ((p2.number ? p2.number + ' ' : '') + p2.name) : 'Player';
        };
        card.appendChild(el('p', { class: 'eyebrow', style: 'margin:14px 0 6px', text: 'Who is succeeding' }));
        var pl = el('div', { class: 'plrows' });
        rows.forEach(function (r2) {
          var pct = r2.rate === null ? null : Math.round(r2.rate * 100);
          pl.appendChild(el('div', { class: 'plrow' + (r2.id === attributeTo ? ' on' : '') }, [
            el('span', { class: 'pn', text: name(r2.id) }),
            el('span', { class: 'bar' }, [el('i', { style: 'width:' + (pct || 0) + '%' })]),
            el('span', { class: 'pv', text: r2.succ + '/' + r2.opps + (pct === null ? '' : '  ' + pct + '%') })
          ]));
        });
        card.appendChild(pl);
      } else if (roster().length) {
        card.appendChild(el('p', { class: 'hint', style: 'margin:10px 0 0',
          text: 'Nothing counted to a player yet. Set Attribute to before tapping and the count lands on both.' }));
      }
      host.appendChild(card);
    });

    host.appendChild(el('p', { class: 'hint', style: 'margin-top:12px',
      text: 'Every tap saves. Set "Attribute to" and the count also lands against that player, which is the IDP column on your analysis sheet.' }));
  }

  /* ---------- definitions ---------- */
  function editDef(def) {
    var isNew = !def;
    def = def || { id: null, category: '', description: '', principle: '', unit: 'rate' };
    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var panel = el('div', { class: 'card', style: 'max-width:620px;width:100%;max-height:88vh;overflow:auto' });
    panel.appendChild(el('div', { class: 'card-hd' }, [el('h2', { text: isNew ? 'New KPI' : 'Edit KPI' })]));
    var bd = el('div', { class: 'card-bd' });

    var cat = el('input', { type: 'text', value: def.category || '', placeholder: 'Timing and execution of line-breaking passes' });
    var desc = el('textarea', { rows: 3, placeholder: 'What counts as an opportunity, and what counts as a success' });
    desc.value = def.description || '';
    var prin = el('select');
    prin.appendChild(el('option', { value: '', text: '- any principle -' }));
    (window.PRINCIPLES || []).forEach(function (p) {
      prin.appendChild(el('option', { value: p.code, text: '[' + p.clubCode + '] ' + (p.clubName || p.name) }));
    });
    prin.value = def.principle || '';
    var unit = el('select');
    K.UNITS.forEach(function (u) { unit.appendChild(el('option', { value: u.v, text: u.label + ' - ' + u.hint })); });
    unit.value = def.unit || 'rate';

    bd.appendChild(el('div', { class: 'grid g2' }, [
      el('label', { class: 'f span-all' }, [el('span', { text: 'KPI category' }), cat]),
      el('label', { class: 'f span-all' }, [el('span', { text: 'KPI description' }), desc]),
      el('label', { class: 'f' }, [el('span', { text: 'Principle' }), prin]),
      el('label', { class: 'f' }, [el('span', { text: 'Measured as' }), unit])
    ]));
    bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:16px' }, [
      el('button', { class: 'btn turf', text: 'Save KPI', onclick: function () {
        if (!cat.value.trim()) { S.toast('Give it a category.'); return; }
        K.save({ id: def.id, category: cat.value.trim(), description: desc.value.trim(),
          principle: prin.value, unit: unit.value });
        back.remove(); draw(); S.toast('KPI saved.');
      } }),
      el('button', { class: 'btn ghost', text: 'Cancel', onclick: function () { back.remove(); } })
    ]));
    panel.appendChild(bd); back.appendChild(panel);
    document.body.appendChild(back);
    cat.focus();
  }

  function defs() {
    var host = document.getElementById('defs');
    host.innerHTML = '';
    var list = K.all();
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty', style: 'margin:16px' }, [
        el('span', { text: 'No KPIs yet. ' }),
        el('strong', { text: 'Start from your principles' }),
        el('span', { text: ' creates one per principle using your own wording, then edit them down.' })
      ]));
      return;
    }
    var scroll = el('div', { class: 'tbl-scroll' });
    var tbl = el('table', { class: 'grid-t fixed' });
    var W = [110, 240, 380, 150, 120];
    tbl.style.minWidth = W.reduce(function (a, b) { return a + b; }, 0) + 'px';
    var cg = el('colgroup');
    W.forEach(function (x) { cg.appendChild(el('col', { style: 'width:' + x + 'px' })); });
    tbl.appendChild(cg);
    tbl.appendChild(el('thead', {}, [el('tr', {}, ['Principle', 'Category', 'Description', 'Measured as', '']
      .map(function (h) { return el('th', { class: 'prose', text: h }); }))]));
    var body = el('tbody');
    list.forEach(function (x) {
      var p = S.principle(x.principle);
      var u = K.UNITS.filter(function (z) { return z.v === x.unit; })[0];
      body.appendChild(el('tr', {}, [
        el('td', {}, [p ? el('span', { class: 'chip ' + S.momentKey(p.moment), text: p.clubCode })
          : el('span', { class: 'chip off', text: 'any' })]),
        el('td', { class: 'prose', style: 'font-weight:500', text: x.category }),
        el('td', { class: 'prose', style: 'font-size:12.5px', text: x.description || '-' }),
        el('td', { text: u ? u.label : x.unit }),
        el('td', {}, [
          el('button', { class: 'btn ghost sm', text: 'Edit', onclick: function () { editDef(x); } }),
          el('button', { class: 'btn warn sm', text: 'Delete', onclick: function () {
            if (confirm('Delete "' + x.category + '"? Tallies already recorded stay on their sessions.')) { K.remove(x.id); draw(); }
          } })
        ])
      ]));
    });
    tbl.appendChild(body);
    scroll.appendChild(tbl);
    host.appendChild(scroll);
  }

  /* ---------- trend ---------- */
  function trend() {
    var host = document.getElementById('trend');
    host.innerHTML = '';
    var any = false;
    K.all().forEach(function (def) {
      var h = K.history(def.id);
      if (!h.length) return;
      any = true;
      var box = el('div', { style: 'margin-bottom:16px' });
      box.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px', text: def.category }));
      var strip = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center' });
      h.forEach(function (row) {
        var m = K.met(row.t, def.unit);
        strip.appendChild(el('a', {
          class: 'chip ' + (m === null ? '' : (m ? 'ao' : 'dt')),
          style: 'text-decoration:none',
          href: 'planner.html?id=' + encodeURIComponent(row.sessionId),
          title: S.planLabel(row.squad) + (K.targetLabel(row.t, def.unit) ? ' · target ' + K.targetLabel(row.t, def.unit) : ''),
          text: S.fmt(row.date) + '  ' + K.fmtActual(row.t, def.unit)
        }));
      });
      box.appendChild(strip);
      if (h.length >= 2 && def.unit === 'rate') {
        var first = K.rate(h[0].t), last = K.rate(h[h.length - 1].t);
        if (first !== null && last !== null) {
          var d = Math.round((last - first) * 1000) / 10;
          box.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
            text: (d > 0 ? 'Up ' : (d < 0 ? 'Down ' : 'Level, ')) + Math.abs(d) + ' points across ' + h.length + ' sessions.' }));
        }
      }
      host.appendChild(box);
    });
    if (!any) host.appendChild(el('div', { class: 'empty', text: 'Tally a KPI in two sessions and the direction shows here.' }));
  }

  function players() {
    var host = document.getElementById('players');
    if (!host) return;
    host.innerHTML = '';
    var plan = sess ? sess.squad : S.defaultPlanId();
    var who = roster();
    var name = function (id) {
      var p = who.filter(function (x) { return x.id === id; })[0];
      return p ? ((p.number ? p.number + ' ' : '') + p.name) : 'Player';
    };
    var any = false;
    K.all().forEach(function (def) {
      var totals = K.playerTotals(def.id, plan);
      if (!totals.length) return;
      any = true;
      var box = el('div', { style: 'margin-bottom:18px' });
      box.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px', text: def.category }));
      var pl = el('div', { class: 'plrows' });
      totals.forEach(function (r) {
        var pct = r.rate === null ? null : Math.round(r.rate * 100);
        pl.appendChild(el('div', { class: 'plrow' }, [
          el('span', { class: 'pn', text: name(r.id) }),
          el('span', { class: 'bar' }, [el('i', { style: 'width:' + (pct || 0) + '%' })]),
          el('span', { class: 'pv', text: r.succ + '/' + r.opps + (pct === null ? '' : '  ' + pct + '%') +
            '  · ' + r.sessions + ' session' + (r.sessions === 1 ? '' : 's') })
        ]));
      });
      box.appendChild(pl);
      var thin = totals.filter(function (r) { return r.opps < 4; });
      if (thin.length) {
        box.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
          text: thin.length + ' player(s) under four opportunities. Too few to read anything into.' }));
      }
      host.appendChild(box);
    });
    if (!any) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'Nothing counted against a player yet. On the tally sheet, set ' }),
        el('strong', { text: 'Attribute to' }),
        el('span', { text: ' before you tap and the count lands on the team and the player.' })
      ]));
    }
  }

  function csv() {
    var rows = [['Date', 'Squad', 'Principle', 'KPI Category', 'KPI Description', 'Measured as',
      'Target', 'Player', 'Opportunities', 'Successes', 'Result', 'Share of team opportunities',
      'Target met', 'Note', 'Evidence']];
    var who = roster();
    var name = function (id) {
      var p = who.filter(function (x) { return x.id === id; })[0];
      return p ? p.name : id;
    };
    S.sessionList().forEach(function (s) {
      (s.kpis || []).forEach(function (t) {
        var def = K.get(t.id);
        if (!def) return;
        var p = S.principle(def.principle);
        var m = K.met(t, def.unit);
        rows.push([s.date, S.planLabel(s.squad), p ? p.clubCode : '', def.category, def.description,
          def.unit, K.targetLabel(t, def.unit), 'TEAM', t.opps || 0, t.succ || 0, K.actual(t, def.unit), '',
          m === null ? '' : (m ? 'Yes' : 'No'), t.note || '', t.evidence || '']);
        K.playerRows(t).forEach(function (r) {
          var sh = K.share(t, r.id);
          rows.push([s.date, S.planLabel(s.squad), p ? p.clubCode : '', def.category, '', def.unit,
            '', name(r.id), r.opps, r.succ,
            r.rate === null ? '' : Math.round(r.rate * 1000) / 10,
            sh === null ? '' : Math.round(sh * 1000) / 10, '', '', '']);
        });
      });
    });
    if (rows.length === 1) { S.toast('No tallies to export yet.'); return; }
    S.exportAs('KPI_tallies', rows);
  }

  function fillSessions() {
    var sel = document.getElementById('sessionSel');
    sel.innerHTML = '';
    var list = S.sessionList();
    if (!list.length) { sel.appendChild(el('option', { value: '', text: 'No sessions saved yet' })); return; }
    list.forEach(function (s) {
      var p = S.principle(s.principleCode);
      var n = (s.kpis || []).filter(function (t) { return t.opps; }).length;
      sel.appendChild(el('option', { value: s.id,
        text: (n ? '\u25cf ' : '\u25cb ') + S.fmt(s.date) + ' ' + S.planLabel(s.squad) +
          (p ? ' · ' + p.clubCode : '') + (S.isComplete(s) ? '' : ' · draft') }));
    });
    sel.value = sessionId;
  }
  function fillPlayers() {
    var sel = document.getElementById('playerSel');
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '', text: 'Team only' }));
    roster().forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: 'Attribute to ' + p.name })); });
    sel.value = attributeTo;
  }

  function load(id) {
    sessionId = id;
    sess = id ? S.getSession(id) : null;
    if (sess && sess.library) { sess = null; }
    fillPlayers(); drawTally(); players();
  }
  function draw() { fillSessions(); defs(); trend(); drawTally(); players(); }

  document.addEventListener('DOMContentLoaded', function () {
    var q = new URLSearchParams(location.search);
    var list = S.sessionList();
    var lastId = S.prefs().lastSession;
    sessionId = q.get('id') || (lastId && S.getSession(lastId) ? lastId : (list.length ? list[0].id : ''));
    document.getElementById('sessionSel').addEventListener('change', function () { load(this.value); });
    document.getElementById('playerSel').addEventListener('change', function () { attributeTo = this.value; drawTally(); });
    document.getElementById('btnNew').addEventListener('click', function () { editDef(null); });
    document.getElementById('btnCsv').addEventListener('click', csv);
    document.getElementById('btnSeed').addEventListener('click', function () {
      var n = K.seedFromPrinciples();
      S.toast(n ? n + ' KPIs created, one per principle. Edit them down to the few you will actually count.'
        : 'Every principle already has at least one KPI.');
      draw();
    });
    load(sessionId);
    draw();
  });
})();

/* ============================================================
   review.js — session preview and review
   The planned column is derived from the session rather than copied,
   so editing the plan keeps the preview honest. Everything typed here
   is stored on the session, and travels with export and the library.
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el, esc = S.esc;

  var ALIGN = [
    { v: 'aligned', label: 'Aligned', dot: 'green' },
    { v: 'partial', label: 'Partial', dot: 'amber' },
    { v: 'diverged', label: 'Diverged', dot: 'red' }
  ];

  var ROWS = [
    { k: 'sessionObjective', label: 'Session objective' },
    { k: 'instance', label: 'Did the instance appear?' },
    { k: 'subs', label: 'Sub-principles: intended, then worked' },
    { k: 'kpi', label: 'Did the players succeed? (KPIs)', auto: 'kpiActual' },
    { k: 'activityObjective', label: 'Activity objective' },
    { k: 'igs', label: 'Identified game situation and connected game model principle' },
    { k: 'strategy', label: 'Connection to strategy and prioritized learning plan' },
    { k: 'instances', label: 'Instance(s) identified' }
  ];

  var sessionId = '', sess = null, dirty = false;

  /* ---------- the planned column, derived ---------- */
  function planned(key) {
    if (!sess) return '';
    var p = S.principle(sess.principleCode);
    var pLabel = p ? '[' + p.clubCode + '] ' + (p.clubName || p.name) : (sess.principleCode || '');
    switch (key) {
      case 'sessionObjective':
        return [sess.cycleObj, sess.focus].filter(Boolean).join('\n');
      case 'activityObjective':
        /* the objective the activity was given, not the name of the slot it sat in */
        var objNames = actNames(sess.acts);
        return (sess.acts || []).map(function (a, i) {
          var obj = a.objective || a.description || '';
          if (!obj) return '';
          var name = objNames[i];
          return name + ': ' + obj.split('\n').filter(Boolean).join('; ');
        }).filter(Boolean).join('\n');
      case 'igs':
        return [sess.igs, pLabel, sess.cue ? 'Cue: ' + sess.cue : '',
          (sess.subs || []).length ? 'Sub-principles: ' + sess.subs.join(', ') : ''].filter(Boolean).join('\n');
      case 'strategy':
        return [
          sess.strategy && 'Strategy: ' + sess.strategy,
          sess.learningPlan && 'Learning plan: ' + sess.learningPlan,
          sess.objectives && 'Objectives: ' + sess.objectives,
          (sess.keyPlayers || []).filter(function (k) { return k.num || k.name; }).length
            ? 'Individual focus: ' + sess.keyPlayers.map(function (k) {
                return [k.num, k.name, k.why].filter(Boolean).join(' ');
              }).filter(Boolean).join('; ') : ''
        ].filter(Boolean).join('\n');
      case 'subs':
        if (!(sess.subs || []).length) return '';
        var known = p && window.Lists ? window.Lists.subsFor(p.code) : (p ? p.subs : []);
        return sess.subs.map(function (c) {
          var sp = known.filter(function (x) { return x.code === c; })[0];
          return sp ? sp.code + '  ' + sp.text : c;
        }).join('\n');
      case 'instance':
        /* the components as planned; the occurred column is where you say
           which of them were actually present */
        var comps = (sess.components || []).filter(function (c) { return c.text; });
        if (!comps.length && !sess.instanceName) return '';
        return [sess.instanceName].filter(Boolean).concat(
          comps.map(function (c, i) {
            return (i + 1) + '. ' + c.text + (c.filter ? '  [' + c.filter + ']' : '');
          })).join('\n');
      case 'instances':
        return sess.instances || '';
      case 'kpi':
        return (sess.kpis || []).map(function (t) {
          var def = window.KPI && window.KPI.get(t.id);
          if (!def) return '';
          return def.category + ': target ' + (t.target || 'not set') +
            (def.unit === 'rate' && t.target ? '%' : '');
        }).filter(Boolean).join('\n') || '';
      case 'behavior':
        /* the player actions are what you said you would see, grouped by side */
        var acts = (sess.pa || []).filter(Boolean);
        if (!acts.length) return '';
        var groups = (window.CLUB && window.CLUB.playerActions) || {};
        var bySide = {};
        acts.forEach(function (x) {
          var side = 'Offensive';
          Object.keys(groups).forEach(function (g) {
            if (groups[g].indexOf(x) < 0) return;
            side = /^Defending/.test(g) ? 'Defensive' : (/^Transition/.test(g) ? 'Transition' : 'Offensive');
          });
          (bySide[side] = bySide[side] || []).push(x);
        });
        return Object.keys(bySide).map(function (k) {
          return k + ': ' + bySide[k].join(', ');
        }).join('\n');
      case 'coaching':
        var txt = function (v) { return Array.isArray(v) ? v.join(' \u00b7 ') : (v || ''); };
        var coNames = actNames(sess.acts);
        return (sess.acts || []).map(function (a, i) {
          var when = txt(a.when), how = txt(a.how), other = txt(a.other);
          if (!when && !how && !other && !a.coachingPoints) return '';
          return coNames[i] + '\n' +
            [when && '    when: ' + when, how && '    how: ' + how,
             other && '    also: ' + other,
             a.coachingPoints && '    points: ' + a.coachingPoints.split('\n').join('; ')]
              .filter(Boolean).join('\n');
        }).filter(Boolean).join('\n');
    }
    return '';
  }
  /* what the tally actually recorded, so the occurred column starts filled */
  function kpiActual() {
    if (!sess || !window.KPI) return '';
    return (sess.kpis || []).map(function (t) {
      var def = window.KPI.get(t.id);
      if (!def || !t.opps) return '';
      var m = window.KPI.met(t, def.unit);
      return def.category + ': ' + window.KPI.fmtActual(t, def.unit) +
        (m === null ? '' : (m ? ' - target met' : ' - short of target')) +
        (t.note ? ' | ' + t.note : '');
    }).filter(Boolean).join('\n');
  }

  var logView = null;

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

  function renderLog() {
    var host = document.getElementById('ivlog');
    if (!host || !window.IntervLog) return;
    if (!sess) { host.innerHTML = '<div class="empty">Pick a session first.</div>'; return; }
    sess.log = sess.log || [];
    sess.logMeta = sess.logMeta || { length: 0, ended: false };
    logView = window.IntervLog.mount(host, sess.log,
      { roster: roster(), meta: sess.logMeta, onChange: mark });
  }

  /* what was actually logged, so the occurred column starts from evidence */
  function logActual() {
    if (!sess || !(sess.log || []).length) return '';
    var byWhen = {}, byWho = {};
    sess.log.forEach(function (e) {
      (Array.isArray(e.when) ? e.when : (e.when ? [e.when] : [])).forEach(function (k) { byWhen[k] = (byWhen[k] || 0) + 1; });
      if (e.who) byWho[e.who] = (byWho[e.who] || 0) + 1;
    });
    var span = (sess.logMeta && sess.logMeta.length) ||
      Math.max.apply(null, sess.log.map(function (e) { return e.t || 0; })) || 0;
    var stopped = sess.log.reduce(function (a, e) {
      return a + (window.IntervLog.stopsPlay(e) ? (parseFloat(e.dur) || 0) : 0);
    }, 0);
    var top = Object.keys(byWho).sort(function (a, b) { return byWho[b] - byWho[a]; }).slice(0, 3);
    return [
      sess.log.length + ' interventions over ' + window.IntervLog.mmss(span),
      'Play stopped ' + window.IntervLog.mmss(stopped) +
        ', ball rolling ' + window.IntervLog.mmss(Math.max(0, span - stopped)),
      Object.keys(byWhen).map(function (k) { return k + ' x' + byWhen[k]; }).join(', '),
      top.length ? 'Most coached: ' + top.map(function (k) { return k + ' (' + byWho[k] + ')'; }).join(', ') : ''
    ].filter(Boolean).join('\n');
  }

  function slotLabel(k) {
    var sl = ((window.CLUB && window.CLUB.slots) || []).filter(function (x) { return x.key === k; })[0];
    if (sl) return sl.label;
    var m = /^a(\d+)$/.exec(k || '');
    return m ? 'Activity ' + m[1] : 'Activity';
  }
  /* This page reads sessions straight from the store, so it can meet one
     written when the first slot was the warm-up. The planner renumbers those
     positionally the moment it opens them, so the same rule is applied here
     and the two always agree on which activity is which. */
  function actNames(acts) {
    var legacy = (acts || []).some(function (a) { return a.slot === 'warmup' || a.kind === 'warmup'; });
    return (acts || []).map(function (a, i) {
      return a.label || (legacy ? 'Activity ' + (i + 1) : slotLabel(a.slot));
    });
  }

  /* ---------- review record ---------- */
  function rev() {
    if (!sess.review) sess.review = { rows: {}, competency: '' };
    if (!sess.review.rows) sess.review.rows = {};
    return sess.review;
  }
  function row(k) {
    var r = rev();
    if (!r.rows[k]) r.rows[k] = { occurred: '', gaps: '', evidence: '', align: '', plannedOverride: '' };
    return r.rows[k];
  }
  function mark() { dirty = true; document.getElementById('saveState').textContent = 'Unsaved review'; }
  function clean(t) { dirty = false; document.getElementById('saveState').textContent = t || 'Review saved'; }

  /* ---------- rendering ---------- */
  function grid(host, rows) {
    host.innerHTML = '';
    var scroll = el('div', { class: 'tbl-scroll' });
    var tbl = el('table', { class: 'grid-t fixed' });
    var W = (S.prefs().reviewCall !== false) ? [176, 300, 300, 240, 200, 96] : [176, 320, 320, 260, 220];
    tbl.style.minWidth = W.reduce(function (a, b) { return a + b; }, 0) + 'px';
    var cg = el('colgroup');
    W.forEach(function (w) { cg.appendChild(el('col', { style: 'width:' + w + 'px' })); });
    tbl.appendChild(cg);
    var withCall = (S.prefs().reviewCall !== false);
    var heads = ['Element', 'Planned (preview)', 'Occurred (review)', 'Alignment and gaps', 'Evidence'];
    if (withCall) heads.push('Call');
    tbl.appendChild(el('thead', {}, [el('tr', {}, heads.map(function (h) { return el('th', { class: 'prose', text: h }); }))]));

    var body = el('tbody');
    rows.forEach(function (spec) {
      var r = row(spec.k);
      var tr = el('tr');
      tr.appendChild(el('td', { class: 'prose', style: 'font-weight:500', text: spec.label }));

      // planned, derived, editable if he wants to pin different wording
      var pl = el('td', { class: 'prose' });
      var derived = planned(spec.k);
      var shown = r.plannedOverride || derived;
      var box = el('div', { class: 'planned', text: shown || 'Nothing recorded in the plan for this.' });
      if (!shown) box.classList.add('thin');
      pl.appendChild(box);
      pl.appendChild(el('button', {
        class: 'btn ghost sm no-print', style: 'margin-top:6px',
        text: r.plannedOverride ? 'Reset to the plan' : 'Edit wording',
        onclick: function () {
          if (r.plannedOverride) { r.plannedOverride = ''; mark(); draw(); return; }
          var v = prompt('Planned wording for this row', derived);
          if (v === null) return;
          r.plannedOverride = v; mark(); draw();
        }
      }));
      tr.appendChild(pl);

      if (spec.auto === 'kpiActual' && !r.occurred) {
        var auto = kpiActual();
        if (auto) { r.occurred = auto; }
      }
      if (spec.k === 'coaching' && !r.occurred) {
        var lg = logActual();
        if (lg) { r.occurred = lg; }
      }
      ['occurred', 'gaps', 'evidence'].forEach(function (f) {
        var t = el('textarea', { rows: 4, placeholder: f === 'occurred'
          ? (spec.k === 'subs' ? 'Which of them actually got worked, and which did not'
            : (spec.k === 'instance'
              ? 'Did every component appear together? Which one was missing, and what did you do to make it emerge?'
              : 'What actually happened'))
          : (f === 'gaps' ? 'Where it matched, where it did not' : 'What you saw that proves it') });
        t.value = r[f] || '';
        var to;
        t.addEventListener('input', function () {
          r[f] = t.value; mark();
          clearTimeout(to); to = setTimeout(aggregate, 400);
        });
        tr.appendChild(el('td', {}, [t]));
      });

      var showCall = (S.prefs().reviewCall !== false);
      if (!showCall) { body.appendChild(tr); return; }
      var lights = el('div', { class: 'lights' });
      ALIGN.forEach(function (a) {
        var b = el('button', { type: 'button', class: 'light ' + a.dot + (r.align === a.v ? ' on' : ''),
          title: a.label, 'aria-label': a.label });
        b.addEventListener('click', function () {
          r.align = r.align === a.v ? '' : a.v; mark(); draw();
        });
        lights.appendChild(b);
      });
      tr.appendChild(el('td', {}, [lights]));
      body.appendChild(tr);
    });
    tbl.appendChild(body);
    scroll.appendChild(tbl);
    host.appendChild(scroll);
  }

  function draw() {
    var host = document.getElementById('context');
    if (!sess) {
      document.getElementById('hdr').textContent = 'No session selected';
      document.getElementById('hdrMeta').textContent = '';
      ['context', 'behavior', 'coaching'].forEach(function (id) {
        document.getElementById(id).innerHTML = '<div class="empty" style="margin:14px">Write a session first, then review it here.</div>';
      });
      document.getElementById('idBlock').innerHTML = '';
      aggregate();
      return;
    }

    var p = S.principle(sess.principleCode);
    var d = S.dayMerged(sess.squad, sess.date) || {};
    document.getElementById('hdr').textContent =
      S.dow(sess.date) + ' ' + S.fmt(sess.date) + ' · ' + S.planLabel(sess.squad);
    document.getElementById('hdrMeta').textContent =
      [p ? '[' + p.clubCode + '] ' + (p.clubName || p.name) : '', d.block, d.gd, sess.method].filter(Boolean).join(' · ');
    document.getElementById('btnOpenPlan').href = 'planner.html?id=' + encodeURIComponent(sess.id);

    var idb = document.getElementById('idBlock');
    idb.innerHTML = '';
    [['Coach', sess.coach], ['Date', S.fmt(sess.date)], ['Age group', S.planLabel(sess.squad)],
     ['Field / station', sess.location || '-']].forEach(function (x) {
      idb.appendChild(el('div', { class: 'f' }, [
        el('span', { class: 'eyebrow', style: 'margin:0', text: x[0] }),
        el('div', { style: 'font-weight:500', text: x[1] || '-' })
      ]));
    });

    grid(host, ROWS);
    grid(document.getElementById('behavior'), [{ k: 'behavior', label: 'Expected player behavior' }]);
    grid(document.getElementById('coaching'), [{ k: 'coaching', label: 'Intended coaching interactions' }]);

    renderLog();
    var c = document.getElementById('competency');
    c.value = rev().competency || '';
    document.getElementById('periodLabel').textContent = d.block ? d.block + ' onward' : '';
    aggregate();
  }

  /* ---------- aggregate ----------
     The point of doing this every session: the same gap showing up
     four times is a coaching problem, not a session problem. */
  function aggregate() {
    var host = document.getElementById('aggregate');
    host.innerHTML = '';
    var all = S.sessionList().filter(function (s) { return s.review && s.review.rows; });
    if (!all.length) {
      host.appendChild(el('div', { class: 'empty', text: 'Review two or three sessions and the pattern shows up here.' }));
      return;
    }

    var keys = ROWS.concat([{ k: 'behavior', label: 'Player behavior' }, { k: 'coaching', label: 'Coaching interactions' }]);
    var tbl = el('table', { class: 'grid-t' });
    tbl.appendChild(el('thead', {}, [el('tr', {}, ['Element', 'Aligned', 'Partial', 'Diverged', 'Rated']
      .map(function (h) { return el('th', { text: h }); }))]));
    var body = el('tbody');
    var worst = null;
    keys.forEach(function (spec) {
      var n = { aligned: 0, partial: 0, diverged: 0 };
      all.forEach(function (s) {
        var r = s.review.rows[spec.k];
        if (r && r.align) n[r.align]++;
      });
      var rated = n.aligned + n.partial + n.diverged;
      if (rated && (!worst || n.diverged > worst.n.diverged)) worst = { spec: spec, n: n };
      var tr = el('tr');
      tr.appendChild(el('td', { class: 'prose', text: spec.label }));
      [['aligned', 'ao'], ['partial', 'at'], ['diverged', 'dt']].forEach(function (x) {
        tr.appendChild(el('td', {}, [n[x[0]]
          ? el('span', { class: 'chip ' + x[1], text: String(n[x[0]]) })
          : el('span', { class: 'chip off', text: '0' })]));
      });
      tr.appendChild(el('td', { text: String(rated) }));
      body.appendChild(tr);
    });
    tbl.appendChild(body);
    host.appendChild(tbl);

    var done = all.filter(function (s) { return reviewComplete(s); }).length;
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:12px',
      text: done + ' of ' + S.sessionList().length + ' saved sessions carry a review, drafts included.' }));
    if (worst && worst.n.diverged >= 2) {
      host.appendChild(el('p', { class: 'hint', style: 'margin-top:6px' }, [
        el('strong', { text: 'Recurring gap: ' }),
        el('span', { text: worst.spec.label.toLowerCase() + ' has diverged ' + worst.n.diverged +
          ' times. Worth carrying into your competency focus.' })
      ]));
    }
  }

  function reviewComplete(s) {
    if (!s.review || !s.review.rows) return false;
    return Object.keys(s.review.rows).some(function (k) {
      var r = s.review.rows[k];
      return r && (r.occurred || r.align);
    });
  }

  /* ---------- save ---------- */
  function save() {
    if (!sess) return;
    rev().competency = document.getElementById('competency').value;
    rev().reviewedAt = new Date().toISOString();
    var stored = S.getSession(sess.id);
    if (stored && stored.library) {
      // a library session is read-only; keep the review on an editable copy
      sess.id = S.newId();
      sess.library = false;
      S.toast('Library session copied so the review has somewhere to live.');
    }
    if (!S.saveSession(sess)) return;
    sessionId = sess.id;
    clean();
    fillSessionSelect();
    aggregate();
  }

  function fillSessionSelect() {
    var sel = document.getElementById('sessionSel');
    sel.innerHTML = '';
    var list = S.sessionList();
    if (!list.length) {
      sel.appendChild(el('option', { value: '', text: 'No sessions saved yet' }));
      return;
    }
    list.forEach(function (s) {
      var p = S.principle(s.principleCode);
      sel.appendChild(el('option', {
        value: s.id,
        text: (reviewComplete(s) ? '\u2713 ' : '\u00b7 ') + S.fmt(s.date) + ' ' + S.planLabel(s.squad) +
          (p ? ' · ' + p.clubCode : '') + (S.isComplete(s) ? '' : ' · draft')
      }));
    });
    sel.value = sessionId;
  }

  function load(id) {
    sessionId = id;
    sess = id ? JSON.parse(JSON.stringify(S.getSession(id) || null)) : null;
    if (sess && !sess.review) {
      // carry the competency thread forward from the most recent review
      var prev = S.sessionList().filter(function (s) {
        return s.review && s.review.competency && s.date <= sess.date && s.id !== sess.id;
      })[0];
      sess.review = { rows: {}, competency: prev ? prev.review.competency : '' };
    }
    draw();
    clean(sess ? (reviewComplete(sess) ? 'Reviewed' : 'Not reviewed yet') : '');
  }

  /* ---------- export ---------- */
  function csv() {
    var rows = [['Date', 'Squad', 'Coach', 'Section', 'Element', 'Planned', 'Occurred', 'Alignment and gaps', 'Evidence', 'Call', 'Competency focus']];
    S.sessionList().forEach(function (s) {
      if (!s.review || !s.review.rows) return;
      var keep = sess; sess = s;
      ROWS.concat([{ k: 'behavior', label: 'Expected player behavior' },
        { k: 'coaching', label: 'Intended coaching interactions' }]).forEach(function (spec) {
        var r = s.review.rows[spec.k] || {};
        rows.push([s.date, S.planLabel(s.squad), s.coach || '',
          ROWS.some(function (x) { return x.k === spec.k; }) ? 'Training context'
            : (spec.k === 'behavior' ? 'Player behavior' : "Coach's influence"),
          spec.label, r.plannedOverride || planned(spec.k), r.occurred || '', r.gaps || '',
          r.evidence || '', r.align || '', s.review.competency || '']);
      });
      sess = keep;
    });
    if (rows.length === 1) { S.toast('No reviews to export yet.'); return; }
    S.download('Session_reviews.csv', S.toCSV(rows), 'text/csv');
  }

  function buildPrint() {
    if (!sess) { document.getElementById('printOnly').innerHTML = '<p>No session selected.</p>'; return; }
    var p = S.principle(sess.principleCode);
    function block(title, rows) {
      /* Five columns across a portrait page is unreadable. Each element gets a
         block: planned and occurred side by side, the call and the evidence under. */
      var h = '<h2 class="rv-h">' + esc(title) + '</h2>';
      rows.forEach(function (spec) {
        var r = (sess.review && sess.review.rows[spec.k]) || {};
        var pl = r.plannedOverride || planned(spec.k);
        if (!pl && !r.occurred && !r.gaps && !r.evidence) return;
        h += '<div class="rv-row">' +
          '<p class="rv-lab">' + esc(spec.label) +
            (r.align ? '<span class="rv-call rv-' + esc(r.align) + '">' + esc(r.align) + '</span>' : '') + '</p>' +
          '<div class="rv-two">' +
            '<div><span class="rv-k">Planned</span>' + esc(pl || '-') + '</div>' +
            '<div><span class="rv-k">Occurred</span>' + esc(r.occurred || '-') + '</div>' +
          '</div>' +
          (r.gaps ? '<div class="rv-full"><span class="rv-k">Alignment and gaps</span>' + esc(r.gaps) + '</div>' : '') +
          (r.evidence ? '<div class="rv-full"><span class="rv-k">Evidence</span>' + esc(r.evidence) + '</div>' : '') +
          '</div>';
      });
      return h;
    }
    var html = '<h1 style="margin:0 0 2pt;font-size:15pt">Session preview and review</h1>' +
      '<p style="margin:0 0 8pt;font-size:9.5pt">Identify (preview) &rarr; Respond (session) &rarr; Measure (review)</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:6pt"><tr>' +
      ['Coach: ' + (sess.coach || ''), 'Date: ' + S.fmt(sess.date),
       'Age group: ' + S.planLabel(sess.squad), 'Field / station: ' + (sess.location || '')]
        .map(function (x) { return '<td style="padding:3pt;border:.5pt solid #999">' + esc(x) + '</td>'; }).join('') +
      '</tr></table>' +
      (p ? '<p style="margin:0 0 6pt;font-size:9pt">Principle: ' + esc('[' + p.clubCode + '] ' + (p.clubName || p.name)) + '</p>' : '') +
      block('Training context', ROWS) +
      block('Player behavior', [{ k: 'behavior', label: 'Expected player behavior' }]) +
      block("Coach's influence on player behavior", [{ k: 'coaching', label: 'Intended coaching interactions' }]) +
      ((sess.log || []).length
        ? '<div style="background:#143250;color:#fff;padding:3pt 5pt;font-weight:600;margin-top:8pt">Timed coaching interventions</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:8.5pt">' +
          '<tr>' + ['At', 'Lasted', 'Who', 'When', 'How', 'Note'].map(function (x) {
            return '<th style="text-align:left;padding:2pt 4pt;border:.5pt solid #999">' + x + '</th>';
          }).join('') + '</tr>' +
          sess.log.slice().sort(function (a, b) { return a.t - b.t; }).map(function (e) {
            return '<tr>' + [window.IntervLog.mmss(e.t), window.IntervLog.fmtDur(e.dur), e.who || '',
              window.IntervLog.asText(e.when), window.IntervLog.asText(e.how), e.note || ''].map(function (x) {
              return '<td style="padding:2pt 4pt;border:.5pt solid #999">' + esc(x) + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</table>'
        : '') +
      '<div style="background:#143250;color:#fff;padding:3pt 5pt;font-weight:600;margin-top:8pt">Competency focus for the development period</div>' +
      '<p style="padding:4pt;border:.5pt solid #999;margin:0;font-size:9pt;white-space:pre-wrap;min-height:16mm">' +
      esc((sess.review && sess.review.competency) || '') + '</p>';
    document.getElementById('printOnly').innerHTML = html;
    document.body.classList.add('has-printsheet', 'reviewsheet');
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var q = new URLSearchParams(location.search);
    var list = S.sessionList();
    var lastId = S.prefs().lastSession;
    sessionId = q.get('id') || (lastId && S.getSession(lastId) ? lastId : (list.length ? list[0].id : ''));
    fillSessionSelect();
    document.getElementById('sessionSel').addEventListener('change', function () {
      if (dirty && !confirm('Switch session and lose the unsaved review?')) {
        this.value = sessionId; return;
      }
      load(this.value);
    });
    var ct = document.getElementById('callToggle');
    if (ct) {
      ct.checked = (S.prefs().reviewCall !== false);
      ct.addEventListener('change', function () { S.setPref('reviewCall', ct.checked); draw(); });
    }
    document.getElementById('competency').addEventListener('input', function () { mark(); });
    document.getElementById('btnSave').addEventListener('click', save);
    document.getElementById('btnCsv').addEventListener('click', csv);
    document.getElementById('btnPrint').addEventListener('click', function () { buildPrint(); window.print(); });
    window.addEventListener('beforeprint', buildPrint);
    if (window.Autosave) window.Autosave.register({
      save: function () { save(); }, isDirty: function () { return dirty; }
    });
    window.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });
    load(sessionId);
  });
})();

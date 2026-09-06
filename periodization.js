/* ============================================================
   periodization.js
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el, esc = S.esc;

  var EVENTS = ['Training Session', 'Training Cancelled', 'Game HOME', 'Game AWAY', 'Game NEUTRAL',
    'Game Cancelled', 'Other', 'OFF', 'OFF - public holiday', 'OFF - school break',
    'OFF - club shutdown', 'OFF - weather'];
  var ABSENCE = ['', 'Course', 'Work', 'Illness', 'Family', 'Other club duty', 'Other'];
  var PA_COLS = 4;
  var RPE = ['', 'Recovery 2-3 RPE', 'Organizational 4-5 RPE', 'Maintenance 6-7 RPE',
    'Threshold 7-8 RPE', 'Fitness 8-9 RPE', 'Game 9-10 RPE'];
  var PHASES = {
    'Attacking Organization': ['Building', 'Attacking', 'Finishing'],
    'Defensive Organization': ['Impeding', 'Recovering', 'Protecting'],
    'Attacking Transition': ['Gaining Possession — Counter Attack', 'Gaining Possession — Secure Reorganize'],
    'Defensive Transition': ['Losing Possession — Counter-Press', 'Losing Possession — Reorganize']
  };

  var squad = S.defaultPlanId();
  var blockFilter = 'all';

  /* every dropdown on this page reads the shared lists, so anything added or
     hidden in the list editor is here too, with the shipped club data as the
     fallback when Lists has not loaded */
  function listOf(key) {
    return (window.Lists ? window.Lists.get(key) : null) ||
      (window.CLUB && window.CLUB[key]) || [];
  }
  function groupsOf(key) {
    return (window.Lists ? window.Lists.getGroups(key) : null) ||
      (window.CLUB && window.CLUB[key]) || {};
  }

  /* ---------- block ribbon ---------- */
  function ribbon() {
    var rows = S.days(squad);
    var host = document.getElementById('blockRibbon');
    var axis = document.getElementById('blockAxis');
    host.innerHTML = ''; axis.innerHTML = '';
    /* only a submitted session marks the day. A prescription typed on the row
       below is guidance for a session, not the session itself. */
    var state = {};
    S.sessionList().forEach(function (s) {
      if (s.squad !== squad) return;
      if (S.isComplete(s)) state[s.date] = 'planned';
      else if (state[s.date] !== 'planned') state[s.date] = 'drafted';
    });

    rows.forEach(function (r) {
      var cancelled = /Cancelled/.test(r.event);
      var c = cancelled ? 'cancelled'
        : (r.event === 'Training Session' ? 'train'
          : (r.event.indexOf('Game') === 0 ? 'game' : (/^OFF/.test(r.event) ? '' : 'other')));
      var h = cancelled ? 40
        : (r.event === 'Training Session' ? (r.mins === 90 ? 100 : 78)
          : (r.event.indexOf('Game') === 0 ? 100 : (/^OFF/.test(r.event) ? 26 : 60)));
      host.appendChild(el('div', {
        class: 'sr-day ' + c + (state[r.date] ? ' ' + state[r.date] : ''),
        style: 'height:' + h + '%',
        title: r.date + ' · ' + r.event + (r.cancelReason ? ' (' + r.cancelReason + ')' : '') +
          (r.opp ? ' v ' + r.opp : '') +
          (state[r.date] === 'planned' ? ' · session complete'
            : (state[r.date] === 'drafted' ? ' · session in draft' : ''))
      }));
    });

    var blocks = S.planBlocks(squad);
    if (!blocks.length) {
      axis.appendChild(el('div', { class: 'sr-blk', style: 'flex:1', text: 'No blocks set on this plan' }));
      return;
    }
    blocks.forEach(function (b) {
      var n = rows.filter(function (r) { return r.date >= b.start && r.date <= b.end; }).length;
      axis.appendChild(el('div', { class: 'sr-blk', style: 'flex:' + n + ' 1 0', text: b.name + ' · ' + S.fmt(b.start) }));
    });
  }

  /* ---------- stats ---------- */
  function stats() {
    var rows = S.days(squad);
    var t = rows.filter(function (r) { return r.event === 'Training Session'; });
    var mine = t.filter(function (r) { return !r.coveredBy; });
    var lost = rows.filter(function (r) { return r.event === 'Training Cancelled'; });
    var g = rows.filter(function (r) { return r.event.indexOf('Game') === 0 && !/Cancelled/.test(r.event); });
    var mins = t.reduce(function (s, r) { return s + (r.mins || parseInt(r.duration, 10) || 0); }, 0);
    var tally = S.sessionTally(squad);
    var host = document.getElementById('stats');
    host.innerHTML = '';
    [[t.length, 'Training days'], [mine.length, 'You delivered'], [lost.length, 'Cancelled'],
     [g.reduce(function (s, r) { return s + (r.games || 1); }, 0), 'Games'],
     [Math.round(mins / 60) + 'h', 'Training time'],
     [tally.complete, 'Sessions complete', tally.draft
       ? tally.draft + ' more in draft' : 'submitted sessions only']].forEach(function (x) {
      host.appendChild(el('div', { class: 'stat' }, [
        el('b', { text: String(x[0]) }), el('span', { text: x[1] }),
        x[2] ? el('span', { class: 'hint',
          style: 'font-size:11px;letter-spacing:0;text-transform:none', text: x[2] }) : null
      ]));
    });
  }

  /* ---------- coverage ---------- */
  function coverage() {
    var host = document.getElementById('coverage');
    var rows = S.days(squad);
    var counts = {};
    rows.forEach(function (r) {
      if (r.principle && !/Cancelled/.test(r.event)) counts[r.principle] = (counts[r.principle] || 0) + 1;
    });
    var codes = Object.keys(counts);
    if (!codes.length) {
      host.innerHTML = '<div class="empty">Nothing sequenced yet. Set a principle on a training row below, or save a session against a date.</div>';
      return;
    }
    var max = Math.max.apply(null, codes.map(function (c) { return counts[c]; }));
    host.innerHTML = '';
    var wrap = el('div', { class: 'grid', style: 'gap:6px' });
    window.PRINCIPLES.forEach(function (p) {
      var n = counts[p.code] || 0;
      if (!n) return;
      var k = S.momentKey(p.moment);
      wrap.appendChild(el('div', { style: 'display:flex;align-items:center;gap:10px' }, [
        el('span', { class: 'chip ' + k, style: 'min-width:66px', text: p.clubCode }),
        el('span', { style: 'flex:0 0 ' + (n / max * 180) + 'px;height:12px;border-radius:2px;background:var(--m-' + k + ')' }),
        el('span', { class: 'hint', text: n + (n === 1 ? ' session' : ' sessions') + ' · ' + (p.clubName || p.name) })
      ]));
    });
    host.appendChild(wrap);
    var unused = window.PRINCIPLES.filter(function (p) { return !counts[p.code]; }).map(function (p) { return p.code; });
    if (unused.length) host.appendChild(el('p', { class: 'hint', style: 'margin-top:12px', text: 'Not yet sequenced: ' + unused.join(', ') }));
  }

  /* ---------- table ---------- */
  function sel(value, options, cb, cls) {
    var s = el('select', { class: cls || '', style: 'padding:4px 6px;font-size:12.5px' });
    options.forEach(function (o) {
      var v = typeof o === 'string' ? o : o.v, t = typeof o === 'string' ? o : o.t;
      s.appendChild(el('option', { value: v, text: t }));
    });
    s.value = value || '';
    s.addEventListener('change', function () { cb(s.value); });
    return s;
  }
  function txt(value, cb, ph) {
    var i = el('input', { type: 'text', value: value || '', placeholder: ph || '', style: 'padding:4px 6px;font-size:12.5px' });
    var t;
    i.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { cb(i.value); }, 350); });
    return i;
  }

  function table() {
    var host = document.getElementById('planTable');
    host.innerHTML = '';
    var rows = S.days(squad).filter(function (r) { return blockFilter === 'all' || r.block === blockFilter; });
    document.getElementById('tableTitle').textContent = S.planLabel(squad) + ' · ' + (blockFilter === 'all' ? 'Whole season' : blockFilter);

    var WIDTHS = [46, 62, 62, 150, 96, 148, 150, 160, 190, 172, 160, 140, 100, 136, 140, 96];
    host.className = 'grid-t fixed';
    host.style.minWidth = WIDTHS.reduce(function (a, b) { return a + b; }, 0) + 'px';
    var cg = el('colgroup');
    WIDTHS.forEach(function (w) { cg.appendChild(el('col', { style: 'width:' + w + 'px' })); });
    host.appendChild(cg);

    var head = el('thead', {}, [el('tr', {}, [
      'Day', 'Date', 'GD', 'Event', 'Duration', 'Physical load', 'Moment', 'Phase', 'Principle',
      'Team focus', 'Player actions', 'Game size', 'Readiness', 'Delivered by', 'Notes', 'Session'
    ].map(function (h) { return el('th', { text: h }); }))]);
    host.appendChild(head);

    var body = el('tbody');
    var today = S.todayISO();
    var lastWeek = null;
    var sessionsByDate = {};
    S.sessionList().forEach(function (s) { if (s.squad === squad) (sessionsByDate[s.date] = sessionsByDate[s.date] || []).push(s); });

    rows.forEach(function (r) {
      if (r.week !== lastWeek) {
        lastWeek = r.week;
        var wk = S.days(squad).filter(function (x) { return x.week === r.week; });
        var tr = wk.filter(function (x) { return x.event === 'Training Session'; }).length;
        var cx = wk.filter(function (x) { return x.event === 'Training Cancelled'; }).length;
        var gm = wk.reduce(function (s, x) {
          return s + (x.event.indexOf('Game') === 0 && !/Cancelled/.test(x.event) ? (x.games || 1) : 0);
        }, 0);
        body.appendChild(el('tr', { class: 'wkband' }, [el('td', {
          colspan: 16, class: 'prose',
          html: 'Week ' + r.week + ' · ' + esc(r.block) +
            '<span class="rt">' + tr + ' training' + (cx ? ', ' + cx + ' cancelled' : '') +
            ' · ' + gm + ' game' + (gm === 1 ? '' : 's') + '</span>'
        })]));
      }

      var isGame = r.event.indexOf('Game') === 0;
      var cancelled = /Cancelled/.test(r.event);
      var cls = (/^OFF/.test(r.event) ? 'off ' : '') + (isGame ? 'gameday ' : '') +
        (cancelled ? 'cancelled ' : '') + (r.coveredBy ? 'covered ' : '') + (r.date === today ? 'today' : '');
      var tr2 = el('tr', { class: cls.trim() });
      function put(k, v) { var o = {}; o[k] = v; S.setPlan(squad, r.date, o); refreshSoft(); }

      tr2.appendChild(el('td', { html: '<span style="font-family:var(--mono);font-size:11px">' + esc(r.dow.slice(0, 3)) + '</span>' }));
      tr2.appendChild(el('td', { html: '<span style="font-family:var(--mono);font-size:11.5px">' + esc(S.fmt(r.date)) + '</span>' }));
      tr2.appendChild(el('td', {}, [el('span', { class: 'chip ' + (r.gd === 'Game' ? 'game' : ''), text: r.gd || '-' })]));

      // event, with a cancel reason appearing underneath when relevant
      var evCell = el('td');
      var evStack = el('div', { class: 'stackcell' });
      evCell.appendChild(evStack);
      evStack.appendChild(sel(r.event, EVENTS, function (v) {
        var patch = { event: v };
        if (!/Cancelled/.test(v)) patch.cancelReason = '';
        if (v === 'Training Session' && !r.mins && !r.duration) patch.duration = '75 Minutes';
        S.setPlan(squad, r.date, patch); table(); refreshSoft(); coverage();
      }));
      if (cancelled) {
        evStack.appendChild(sel(r.cancelReason, [''].concat(listOf('cancelReasons')),
          function (v) { put('cancelReason', v); }));
      }
      tr2.appendChild(evCell);

      tr2.appendChild(el('td', {}, [txt(r.duration, function (v) { put('duration', v); }, 'e.g. 75 Minutes')]));
      tr2.appendChild(el('td', {}, [sel(r.rpe, RPE, function (v) { put('rpe', v); })]));

      tr2.appendChild(el('td', {}, [sel(r.moment, [''].concat(Object.keys(PHASES)), function (v) {
        S.setPlan(squad, r.date, { moment: v, phase: '', principle: '' }); table(); coverage();
      })]));
      var phaseOpts = r.moment
        ? [{ v: '', t: '-' }].concat((PHASES[r.moment] || []).map(function (x) { return { v: x, t: x }; }))
        : [{ v: '', t: '-' }].concat(Object.keys(PHASES).reduce(function (a, m) {
            return a.concat(PHASES[m].map(function (x) { return { v: x, t: m.split(' ')[0] + ' · ' + x }; }));
          }, []));
      tr2.appendChild(el('td', {}, [sel(r.phase, phaseOpts, function (v) {
        var patch = { phase: v };
        if (!r.moment) Object.keys(PHASES).forEach(function (m) {
          if (PHASES[m].indexOf(v) >= 0) patch.moment = m;
        });
        S.setPlan(squad, r.date, patch); table(); coverage();
      })]));

      var pOpts = [{ v: '', t: '-' }].concat((window.PRINCIPLES || [])
        .filter(function (p) {
          if (r.moment && p.moment !== r.moment) return false;
          if (r.phase && p.phases.indexOf(r.phase) < 0) return false;
          return true;
        })
        .map(function (p) { return { v: p.code, t: '[' + p.clubCode + '] ' + (p.clubName || p.name) }; }));
      tr2.appendChild(el('td', {}, [sel(r.principle, pOpts, function (v) {
        var p = S.principle(v);
        S.setPlan(squad, r.date, p ? { principle: v, moment: p.moment, phase: r.phase || '' } : { principle: '' });
        table(); coverage();
      })]));

      // team focus: pick from the club's intentions, or type your own
      var focusCell = el('td', { class: 'prose' });
      var fStack = el('div', { class: 'stackcell' });
      var fOpts = [{ v: '', t: '- pick an intention -' }];
      var intentions = groupsOf('intentions');
      Object.keys(intentions).forEach(function (g) {
        (intentions[g] || []).forEach(function (x) { fOpts.push({ v: x, t: x }); });
      });
      fStack.appendChild(sel('', fOpts, function (v) { if (v) put('focus', v); table(); }));
      fStack.appendChild(txt(r.focus, function (v) { put('focus', v); }, 'or type your own'));
      focusCell.appendChild(fStack);
      tr2.appendChild(focusCell);

      // player actions, two to four
      var paCell = el('td');
      var paStack = el('div', { class: 'stackcell' });
      paCell.appendChild(paStack);
      var pa = r.pa || [r.pa1 || '', r.pa2 || '', '', ''];
      var shown = Math.max(2, pa.filter(Boolean).length + (pa.filter(Boolean).length < PA_COLS ? 1 : 0));
      for (var i = 0; i < shown; i++) {
        (function (i) {
          var opts = [{ v: '', t: '-' }];
          var lists = groupsOf('playerActions');
          Object.keys(lists).forEach(function (gname) {
            (lists[gname] || []).forEach(function (a) { opts.push({ v: a, t: a }); });
          });
          paStack.appendChild(sel(pa[i] || '', opts, function (v) {
            var next = (r.pa || [pa[0], pa[1], '', '']).slice();
            next[i] = v;
            S.setPlan(squad, r.date, { pa: next, pa1: next[0], pa2: next[1] });
            table(); refreshSoft();
          }));
        })(i);
      }
      tr2.appendChild(paCell);

      /* the universal objective the day is built around; the planner reads it
         so the size is decided once, in the plan, not again in the session */
      var gsCell = el('td');
      if (r.event === 'Training Session') {
        gsCell.appendChild(sel(r.gameSize,
          [{ v: '', t: '-' }].concat(((window.CLUB && window.CLUB.gameSizes) || []).map(function (x) {
            return { v: x.key, t: x.label };
          })), function (v) { put('gameSize', v); }));
        var gx = ((window.CLUB && window.CLUB.gameSizes) || []).filter(function (x) { return x.key === r.gameSize; })[0];
        if (gx) gsCell.appendChild(el('div', { class: 'hint', style: 'font-size:10.5px;margin-top:2px',
          text: gx.objective }));
      } else {
        gsCell.appendChild(el('span', { class: 'hint', text: '-' }));
      }
      tr2.appendChild(gsCell);

      /* readiness comes from the session written for this date, so the number
         you polled at the field sits next to the load you planned */
      var rdCell = el('td');
      var sOn = (sessionsByDate[r.date] || [])[0];
      var rd = sOn ? readinessOf(sOn) : null;
      if (rd && rd.polled) {
        rdCell.appendChild(el('span', {
          class: 'chip ' + (rd.score >= 4.3 ? 'ao' : (rd.score >= 3.5 ? 'at' : 'dt')),
          title: rd.counted + ' player(s) counted', text: rd.score.toFixed(1)
        }));
        if (r.rpe && rd.score < 3.5) {
          rdCell.appendChild(el('div', { class: 'hint', style: 'font-size:10.5px;margin-top:2px',
            text: 'load may be high' }));
        }
      } else {
        rdCell.appendChild(el('span', { class: 'chip off', text: sOn ? 'not polled' : '-' }));
      }
      tr2.appendChild(rdCell);

      // who actually took it: a session someone else delivered is not one of your coaching cycles
      var covCell = el('td');
      var covStack = el('div', { class: 'stackcell' });
      covCell.appendChild(covStack);
      if (r.event === 'Training Session' || isGame) {
        covStack.appendChild(sel(r.coveredBy ? 'other' : 'me',
          [{ v: 'me', t: 'Me' }, { v: 'other', t: 'Someone else' }],
          function (v) {
            S.setPlan(squad, r.date, v === 'me'
              ? { coveredBy: '', absenceReason: '' }
              : { coveredBy: r.coveredBy || 'Cover coach' });
            table(); refreshSoft();
          }));
        if (r.coveredBy) {
          covStack.appendChild(txt(r.coveredBy, function (v) { put('coveredBy', v); }, 'who covered'));
          covStack.appendChild(sel(r.absenceReason, ABSENCE, function (v) { put('absenceReason', v); }));
        }
      } else {
        covStack.appendChild(el('span', { class: 'hint', text: '-' }));
      }
      tr2.appendChild(covCell);

      tr2.appendChild(el('td', { class: 'prose' }, [txt(r.notes, function (v) { put('notes', v); }, isGame ? '' : 'weather, absences')]));

      // session link
      var td = el('td');
      var linked = sessionsByDate[r.date] || [];
      if (linked.length) {
        linked.forEach(function (ss) {
          var pp = S.principle(ss.principleCode);
          td.appendChild(el('a', {
            class: 'btn ghost sm', style: 'display:block;margin-bottom:3px',
            href: 'planner.html?id=' + encodeURIComponent(ss.id),
            text: (pp ? pp.clubCode : 'Open') + (S.isComplete(ss) ? '' : ' \u00b7 finish')
          }));
          /* draft or complete, said plainly: a started session is not a written one */
          td.appendChild(el('span', {
            class: 'chip ' + S.statusChip(ss), style: 'display:inline-block;margin-right:3px',
            title: S.isComplete(ss)
              ? 'Submitted' + (ss.submittedAt ? ' ' + S.fmt(ss.submittedAt.slice(0, 10)) : '')
              : 'Saved but not submitted, so it does not count as written',
            text: S.isComplete(ss) ? 'complete' : 'draft'
          }));
          var reviewed = ss.review && ss.review.rows && Object.keys(ss.review.rows).some(function (k) {
            var r = ss.review.rows[k];
            return r && (r.occurred || r.align);
          });
          td.appendChild(el('a', {
            class: 'chip ' + (reviewed ? 'ao' : 'off'), style: 'display:inline-block;text-decoration:none',
            href: 'review.html?id=' + encodeURIComponent(ss.id),
            title: reviewed ? 'Review written' : 'Not reviewed yet',
            text: reviewed ? 'reviewed' : 'review'
          }));
        });
        if (r.principle && linked.every(function (ss) { return ss.principleCode !== r.principle; })) {
          td.appendChild(el('span', { class: 'chip flag', text: 'differs from row' }));
        }
      } else if (r.event === 'Training Session') {
        td.appendChild(el('a', {
          class: 'btn ghost sm no-print',
          href: 'planner.html?date=' + r.date + '&squad=' + encodeURIComponent(squad) +
            (r.principle ? '&principle=' + r.principle : '') +
            (r.focus ? '&focus=' + encodeURIComponent(r.focus) : '') +
            ((r.pa || []).filter(Boolean).length ? '&pa=' + encodeURIComponent((r.pa || []).filter(Boolean).join('|')) : ''),
          text: 'Plan'
        }));
      } else if (cancelled) {
        td.appendChild(el('span', { class: 'chip off', text: 'no session' }));
      }
      if (isGame && !cancelled) {
        /* one link per game on the date, each with its own sheet */
        var games = (r.fixtures && r.fixtures.length) ? r.fixtures : [{ i: 0, opp: r.opp, ha: r.ha, ko: r.ko }];
        games.forEach(function (gf) {
          var l2 = window.Lineup.get(squad, r.date, gf.i);
          var n2 = l2 ? (l2.xi || []).concat(l2.subs || [])
            .filter(function (x) { return x.playerId; }).length : 0;
          td.appendChild(el('a', {
            class: 'btn ' + (n2 ? 'ghost' : 'turf') + ' sm no-print', style: 'display:block;margin-bottom:3px',
            href: 'lineups.html?plan=' + encodeURIComponent(squad) +
              '&fixture=' + encodeURIComponent(r.date + '#' + gf.i),
            title: (gf.opp ? (gf.ha === 'A' ? 'at ' : 'v ') + gf.opp : 'Game ' + (gf.i + 1)) +
              (gf.ko ? ', ' + gf.ko : ''),
            text: (games.length > 1 ? 'G' + (gf.i + 1) + ' ' : '') +
              (n2 ? n2 + ' named' : 'Team sheet') +
              (l2 && l2.formation ? ' \u00b7 ' + l2.formation : '')
          }));
        });
      }
      if (r.event === 'Training Session') {
        td.appendChild(el('button', {
          class: 'btn warn sm no-print', style: 'display:block;margin-top:3px', text: 'Cancel',
          onclick: function () {
            var why = prompt('Why was it cancelled?\n\nWeather, Field unavailable, Numbers too low, Coach away, Club event, School conflict, Other', 'Weather');
            if (why === null) return;
            S.setPlan(squad, r.date, { event: 'Training Cancelled', cancelReason: why });
            table(); refreshSoft(); coverage();
          }
        }));
      } else if (cancelled) {
        td.appendChild(el('button', {
          class: 'btn ghost sm no-print', style: 'display:block;margin-top:3px', text: 'Restore',
          onclick: function () {
            S.setPlan(squad, r.date, { event: 'Training Session', cancelReason: '' });
            table(); refreshSoft(); coverage();
          }
        }));
      }
      tr2.appendChild(td);
      body.appendChild(tr2);
    });
    host.appendChild(body);
  }

  /* the same arithmetic the planner uses: mean of the player means, present only */
  function readinessOf(sess) {
    var items = ((window.CLUB && window.CLUB.readiness) || { items: [] }).items;
    var ready = sess.ready || {};
    if (sess.readyMode === 'squad' || ready.squad) {
      var t = 0, n = 0;
      items.forEach(function (it) { if (ready.squad && ready.squad[it.k]) { t += ready.squad[it.k]; n++; } });
      return { polled: n > 0, score: n ? t / n : 0, counted: n ? 1 : 0 };
    }
    var total = 0, counted = 0;
    Object.keys(ready).forEach(function (pid) {
      if (pid === 'squad') return;
      var rec = ready[pid];
      if (!/^Present/.test(rec.att || 'Present')) return;
      var a = 0, b = 0;
      items.forEach(function (it) { if (rec[it.k]) { a += rec[it.k]; b++; } });
      if (b) { total += a / b; counted++; }
    });
    return { polled: counted > 0, score: counted ? total / counted : 0, counted: counted };
  }

  /* ---------- how the session landed ----------
     Four questions plus a split on fatigue, asked in words a thirteen-year-old
     answers honestly. A value sits behind each label so it can be averaged, but
     nobody is asked for a number. */
  var FK = 'ncfc.feedback.v1';
  var fbDate = '', draftResp = {};
  function scales() { return (window.CLUB && window.CLUB.youthScales) || []; }
  function fbAll() { try { return JSON.parse(localStorage.getItem(FK) || '{}'); } catch (e) { return {}; } }
  function fbKey(d) { return squad + '|' + d; }

  /* Responses are anonymous on purpose. A thirteen-year-old asked to put their
     name to "did you enjoy it" will pick the answer they think the coach wants.
     Nothing is stored that identifies who answered, only the answers.
     Named fatigue already exists, per player, in the planner's readiness poll. */
  function fbResponses(d) {
    var rec = fbAll()[fbKey(d)];
    if (!rec) return [];
    if (Array.isArray(rec)) return rec;
    if (Array.isArray(rec.responses)) return rec.responses;
    /* anything left from the earlier per-player version is folded in unnamed */
    return Object.keys(rec).map(function (k) { return rec[k]; });
  }
  function fbAdd(d, resp) {
    var all2 = fbAll(), k = fbKey(d);
    var list = fbResponses(d);
    list.push(resp);
    all2[k] = { responses: list };
    try { localStorage.setItem(FK, JSON.stringify(all2)); } catch (e) {}
  }
  function fbDrop(d, i) {
    var all2 = fbAll(), k = fbKey(d);
    var list = fbResponses(d);
    list.splice(i, 1);
    all2[k] = { responses: list };
    try { localStorage.setItem(FK, JSON.stringify(all2)); } catch (e) {}
  }
  function fbMean(d, key) {
    var list = fbResponses(d), t = 0, n = 0;
    list.forEach(function (r) { if (r[key] != null) { t += r[key]; n++; } });
    return n ? { mean: t / n, n: n } : null;
  }
  function fbCounts(d, sc) {
    var list = fbResponses(d), out = {};
    sc.options.forEach(function (o) { out[o.v] = 0; });
    list.forEach(function (r) { if (r[sc.key] != null && out[r[sc.key]] != null) out[r[sc.key]]++; });
    return out;
  }
  var MIN_N = 4;                       // below this, a mean can identify someone

  function fillFeedbackPickers() {
    var sel = document.getElementById('fbDate');
    if (!sel) return;
    var days = S.planRows(squad).filter(function (r) { return r.event === 'Training Session'; });
    var today = S.todayISO();
    sel.innerHTML = '';
    days.forEach(function (r) {
      var n = fbResponses(r.date).length;
      sel.appendChild(el('option', { value: r.date,
        text: (n ? '\u25cf ' : '\u25cb ') + S.dow(r.date) + ' ' + S.fmt(r.date) +
          (n ? '  ' + n + ' answered' : '') }));
    });
    if (!fbDate) {
      var past = days.filter(function (r) { return r.date <= today; });
      fbDate = past.length ? past[past.length - 1].date : (days[0] || {}).date || '';
    }
    sel.value = fbDate;
  }

  function renderFeedback() {
    var host = document.getElementById('feedback');
    if (!host) return;
    host.innerHTML = '';
    if (!fbDate) {
      host.appendChild(el('div', { class: 'empty', text: 'No training days on this plan yet.' }));
      return;
    }
    var list = fbResponses(fbDate);

    /* one response at a time: hand the device over, they tap, they submit */
    var card = el('div', { class: 'act', style: 'border-left-color:var(--turf)' });
    card.appendChild(el('div', { class: 'act-hd' }, [
      el('span', { class: 'lab', text: 'Answer anonymously' }),
      el('span', { class: 'chip', text: list.length + ' answered so far' })
    ]));
    var bd = el('div', { class: 'act-bd' });
    scales().forEach(function (sc) {
      var aimNow = aimFor(sc, fbDate);
      var seg = el('div', { class: 'seg', style: 'flex-wrap:wrap' });
      sc.options.forEach(function (o) {
        var b = el('button', { type: 'button', text: o.t,
          'aria-pressed': draftResp[sc.key] === o.v ? 'true' : 'false' });
        b.addEventListener('click', function () {
          draftResp[sc.key] = draftResp[sc.key] === o.v ? undefined : o.v;
          renderFeedback();
        });
        seg.appendChild(b);
      });
      bd.appendChild(el('div', { style: 'margin-bottom:12px' }, [
        el('div', { style: 'display:flex;align-items:baseline;gap:8px;flex-wrap:wrap' }, [
          el('span', { class: 'eyebrow', style: 'margin:0', text: sc.label }),
          el('span', { class: 'hint', text: sc.q }),
          aimNow.note ? el('span', { class: 'hint', style: 'margin-left:auto',
            text: aimNow.note + ', aim ' + aimNow.v }) : null
        ]),
        seg
      ]));
    });
    var answered = Object.keys(draftResp).filter(function (k) { return draftResp[k] != null; }).length;
    bd.appendChild(el('div', { class: 'btnrow' }, [
      el('button', {
        class: 'btn insert', style: 'flex:1;justify-content:center;min-height:48px',
        text: answered ? 'Submit and pass it on' : 'Tap an answer above to begin',
        onclick: function () {
          if (!answered) return;
          var clean = {};
          Object.keys(draftResp).forEach(function (k) { if (draftResp[k] != null) clean[k] = draftResp[k]; });
          fbAdd(fbDate, clean);
          draftResp = {};
          renderFeedback(); fillFeedbackPickers(); renderFbTrend();
          S.toast('Recorded. Nothing was saved about who answered.');
        }
      }),
      el('button', { class: 'btn ghost sm', text: 'Clear', onclick: function () { draftResp = {}; renderFeedback(); } })
    ]));
    card.appendChild(bd);
    host.appendChild(card);

    if (!list.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin-top:12px',
        text: 'Nobody has answered yet. Hand the device round, or tap through it yourself for each player.' }));
      return;
    }

    /* the distribution is the answer; the mean is only context */
    host.appendChild(el('p', { class: 'eyebrow', style: 'margin:18px 0 8px',
      text: 'What ' + list.length + ' answer' + (list.length === 1 ? '' : 's') + ' said' }));
    scales().forEach(function (sc) {
      var counts = fbCounts(fbDate, sc);
      var m = fbMean(fbDate, sc.key);
      var total = sc.options.reduce(function (a, o) { return a + counts[o.v]; }, 0);
      if (!total) return;
      var box = el('div', { style: 'margin-bottom:12px' });
      box.appendChild(el('div', { style: 'display:flex;gap:8px;align-items:baseline' }, [
        el('span', { class: 'eyebrow', style: 'margin:0', text: sc.label }),
        el('span', { class: 'hint', style: 'margin-left:auto',
          text: total >= MIN_N && m ? 'average ' + m.mean.toFixed(1)
            : 'average held back until ' + MIN_N + ' have answered' })
      ]));
      var rows2 = el('div', { class: 'plrows' });
      sc.options.forEach(function (o) {
        var pct = Math.round(counts[o.v] / total * 100);
        rows2.appendChild(el('div', { class: 'plrow' }, [
          el('span', { class: 'pn', text: o.t }),
          el('span', { class: 'bar' }, [el('i', { style: 'width:' + pct + '%' })]),
          el('span', { class: 'pv', text: counts[o.v] ? counts[o.v] + '  ' + pct + '%' : '' })
        ]));
      });
      box.appendChild(rows2);
      host.appendChild(box);
    });
    host.appendChild(el('div', { class: 'btnrow', style: 'margin-top:8px' }, [
      el('button', { class: 'btn warn sm', text: 'Remove the last answer',
        onclick: function () {
          if (!confirm('Remove the most recent answer?')) return;
          fbDrop(fbDate, fbResponses(fbDate).length - 1);
          renderFeedback(); fillFeedbackPickers(); renderFbTrend();
        } })
    ]));
    host.appendChild(el('p', { class: 'hint', style: 'margin-top:10px',
      text: 'No name, number or device is recorded against an answer, so nobody can be identified from this. ' +
        'The average is withheld until ' + MIN_N + ' have answered, because with two or three it is not anonymous either. ' +
        'If you need to know which individual is tired, the readiness poll in the planner is named and does that job.' }));
  }

  /* What "just right" means depends on the day. A threshold session should be
     hard; a maintenance session should not. The target moves with the type
     rather than sitting at one number all season. */
  var AIM_BY_TYPE = [
    [/threshold/i, { challenge: 4.2, note: 'a threshold day should feel hard' }],
    [/maintenance/i, { challenge: 2.8, note: 'a maintenance day should not' }],
    [/review/i, { challenge: 3.0, note: 'a review day sits in the middle' }],
    [/development/i, { challenge: 3.6, note: 'a development day should stretch them' }]
  ];
  function aimFor(sc, date) {
    if (sc.key !== 'challenge') return { v: sc.ideal, note: '' };
    var row = S.dayMerged(squad, date) || {};
    var t = row.type || '';
    for (var i = 0; i < AIM_BY_TYPE.length; i++) {
      if (AIM_BY_TYPE[i][0].test(t)) {
        return { v: AIM_BY_TYPE[i][1].challenge, note: AIM_BY_TYPE[i][1].note, type: t };
      }
    }
    return { v: sc.ideal, note: '' };
  }

  function renderFbTrend() {
    var host = document.getElementById('fbTrend');
    if (!host) return;
    host.innerHTML = '';
    var days = S.planRows(squad).filter(function (r) {
      return r.event === 'Training Session' && fbResponses(r.date).length;
    });
    if (days.length < 2) return;
    host.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 8px',
      text: 'Across ' + days.length + ' sessions asked' }));
    scales().forEach(function (sc) {
      var pts = days.map(function (r) { return { date: r.date, m: fbMean(r.date, sc.key) }; })
        .filter(function (x) { return x.m; });
      if (!pts.length) return;
      var avg = pts.reduce(function (a, x) { return a + x.m.mean; }, 0) / pts.length;
      var strip = el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;align-items:center' });
      pts.forEach(function (x) {
        var aim = aimFor(sc, x.date);
        var off = aim.v ? Math.abs(x.m.mean - aim.v) : 0;
        strip.appendChild(el('span', {
          class: 'chip ' + (off <= 0.5 ? 'ao' : (off <= 1.1 ? 'at' : 'dt')),
          title: S.fmt(x.date) + (aim.type ? ' \u00b7 ' + aim.type + ', aiming for ' + aim.v : ''),
          text: x.m.mean.toFixed(1) }));
      });
      host.appendChild(el('div', { style: 'margin-bottom:10px' }, [
        el('div', { style: 'display:flex;gap:8px;align-items:baseline' }, [
          el('span', { class: 'eyebrow', style: 'margin:0', text: sc.label }),
          el('span', { class: 'hint', text: 'average ' + avg.toFixed(1) +
            (sc.key === 'challenge'
              ? ', target follows the session type'
              : (sc.ideal ? ', aiming for about ' + sc.ideal : '')) })
        ]),
        strip
      ]));
    });
    host.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
      text: 'Green is close to where you want it. Too easy and too hard are both amber or red, ' +
        'because a session nobody found difficult is as much of a miss as one nobody could do. ' +
        'For Challenging the target moves with the session type: a threshold day aims at 4.2, ' +
        'a maintenance day at 2.8. Hover a chip to see which applied.' }));
  }

  /* ---------- cycles ----------
     A block has an objective and the players it is aimed at. Their IDP focus
     is what connects the two. */
  var CK = 'ncfc.cycles.v1';
  function cycles() { try { return JSON.parse(localStorage.getItem(CK) || '{}'); } catch (e) { return {}; } }
  function cycleKey(b) { return squad + '|' + b; }
  function cycleOf(b) { return cycles()[cycleKey(b)] || { objective: '', players: [] }; }
  function setCycle(b, patch) {
    var d = cycles(), k = cycleKey(b);
    d[k] = Object.assign({}, d[k] || { objective: '', players: [] }, patch);
    try { localStorage.setItem(CK, JSON.stringify(d)); } catch (e) {}
  }
  function idpFor(planId) {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    var out = [];
    Object.keys(d.players || {}).forEach(function (k) {
      if (d.players[k].plan !== planId) return;
      var focus = 0;
      Object.keys(d.marks || {}).forEach(function (mk) {
        if (mk.indexOf(k + '|') === 0 && d.marks[mk].focus) focus++;
      });
      out.push(Object.assign({ focusCount: focus }, d.players[k]));
    });
    return out.sort(function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }

  function rosterOf() {
    var d;
    try { d = JSON.parse(localStorage.getItem('ncfc.idp.v1') || '{}'); } catch (e) { d = {}; }
    return Object.keys(d.players || {}).map(function (k) { return d.players[k]; })
      .filter(function (p) { return p.plan === squad; })
      .sort(function (a, b) {
        return (parseInt(a.number, 10) || 99) - (parseInt(b.number, 10) || 99) ||
          (a.name || '').localeCompare(b.name || '');
      });
  }

  function renderCycles() {
    var host = document.getElementById('cycles');
    if (!host) return;
    host.innerHTML = '';
    var blocks = S.planBlocks(squad);
    if (!blocks.length) {
      host.appendChild(el('div', { class: 'empty', text: 'This plan has no blocks, so there are no cycles to aim.' }));
      return;
    }
    var roster = idpFor(squad);
    blocks.forEach(function (b) {
      var c = cycleOf(b.name);
      var box = el('div', { class: 'act', style: 'border-left-color:var(--navy)' });
      box.appendChild(el('div', { class: 'act-hd' }, [
        el('span', { class: 'lab', text: b.name }),
        el('span', { class: 'chip', text: S.fmt(b.start) + ' to ' + S.fmt(b.end) }),
        el('span', { class: 'sp' }),
        el('span', { class: 'hint', text: (c.players || []).length + ' player(s) in focus' })
      ]));
      var bd = el('div', { class: 'act-bd' });
      var ob = el('textarea', { rows: 2, placeholder: b.purpose || 'What this cycle is for' });
      ob.value = c.objective || '';
      var t;
      ob.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { setCycle(b.name, { objective: ob.value }); }, 350);
      });
      bd.appendChild(el('label', { class: 'f' }, [el('span', { text: 'Cycle objective' }), ob]));
      bd.appendChild(el('button', {
        class: 'btn ghost sm no-print', style: 'margin-top:5px', text: 'Choose from the game model',
        onclick: function () {
          /* what a cycle can be for: a principle, a style idea, or a stock
             objective. All three come out of the model rather than thin air. */
          var groups = {};
          var byMoment = {};
          (window.PRINCIPLES || []).forEach(function (p2) {
            (byMoment[p2.moment] = byMoment[p2.moment] || []).push(
              '[' + p2.clubCode + '] ' + (p2.clubName || p2.name));
          });
          Object.keys(byMoment).forEach(function (m) { groups['Principles \u00b7 ' + m] = byMoment[m]; });
          try {
            var st = JSON.parse(localStorage.getItem('ncfc.style.v1') || 'null') ||
              ((window.STYLE || {}).entries || []);
            var byM2 = {};
            st.forEach(function (e) { (byM2[e.moment] = byM2[e.moment] || []).push(e.title); });
            Object.keys(byM2).forEach(function (m) { groups['Style \u00b7 ' + m] = byM2[m]; });
          } catch (e) {}
          var stock = window.Lists.get('cycleObjectives') || [];
          if (stock.length) groups['Stock objectives'] = stock;
          window.Lists.multiPick({
            title: 'Objective for ' + b.name, groups: groups,
            listKey: 'cycleObjectives',
            onPick: function (picked) {
              var cur = cycleOf(b.name).objective || '';
              var next = (cur ? cur.replace(/\s*$/, '') + '\n' : '') + picked.join('\n');
              setCycle(b.name, { objective: next });
              renderCycles();
            }
          });
        }
      }));

      if (!roster.length) {
        bd.appendChild(el('p', { class: 'hint', style: 'margin:10px 0 0' }, [
          el('span', { text: 'No roster on this plan. ' }),
          el('a', { href: 'idp.html', text: 'Add players' }),
          el('span', { text: ' to aim a cycle at them.' })
        ]));
      } else {
        bd.appendChild(el('p', { class: 'eyebrow', style: 'margin:12px 0 6px', text: 'Players this cycle is aimed at' }));
        var box2 = el('div', { class: 'subs', style: 'max-height:190px' });
        roster.forEach(function (pl) {
          var cb = el('input', { type: 'checkbox' });
          cb.checked = (c.players || []).indexOf(pl.id) >= 0;
          cb.addEventListener('change', function () {
            var cur = (cycleOf(b.name).players || []).slice();
            var i = cur.indexOf(pl.id);
            if (cb.checked && i < 0) cur.push(pl.id);
            if (!cb.checked && i >= 0) cur.splice(i, 1);
            setCycle(b.name, { players: cur });
            renderCycles();
          });
          box2.appendChild(el('label', {}, [cb,
            el('span', { text: (pl.number ? pl.number + ' ' : '') + pl.name + (pl.position ? ' \u00b7 ' + pl.position : '') }),
            el('span', { class: 'chip ' + (pl.focusCount ? 'ao' : 'off'), style: 'margin-left:auto',
              text: pl.focusCount ? pl.focusCount + ' IDP focus' : 'no IDP focus' })]));
        });
        bd.appendChild(box2);
        var noFocus = (c.players || []).filter(function (id) {
          var p2 = roster.filter(function (x) { return x.id === id; })[0];
          return p2 && !p2.focusCount;
        });
        if (noFocus.length) {
          bd.appendChild(el('p', { class: 'hint', style: 'margin:8px 0 0' }, [
            el('strong', { text: noFocus.length + ' in focus with nothing starred: ' }),
            el('span', { text: 'a cycle aimed at a player who has no IDP focus has nothing to move. ' }),
            el('a', { href: 'idp.html', text: 'Star their criteria' })
          ]));
        }
      }
      box.appendChild(bd);
      host.appendChild(box);
    });
  }


  /* ---------- minutes, and what they ask of the week ---------- */
  function renderMinutes() {
    var host = document.getElementById('minutes');
    if (!host) return;
    host.innerHTML = '';
    var L = window.Lineup;
    var season = L.seasonMinutes(squad);
    if (!season.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'No roster on this plan. ' }),
        el('a', { href: 'idp.html', text: 'Add players' }),
        el('span', { text: ', then fill a team sheet on a game row.' })
      ]));
      return;
    }
    var next = S.nextTraining(squad);
    if (next) {
      var wk = L.weekLoad(squad, next.date, 7);
      host.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 8px',
        text: 'Coming into ' + S.dow(next.date) + ' ' + S.fmt(next.date) +
          (wk.length && wk[0].games ? ' \u00b7 last 7 days, ' + wk[0].games + ' game' +
            (wk[0].games === 1 ? '' : 's') : '') }));
      var week = L.weekLoad(squad, next.date, 7);
      var byBand = {};
      week.forEach(function (r) {
        var k = r.band ? r.band.key : 'none';
        (byBand[k] = byBand[k] || []).push(r);
      });
      L.bandsFor(squad).forEach(function (b) {
        var g = byBand[b.key] || [];
        if (!g.length) return;
        var box = el('div', { style: 'margin-bottom:10px' });
        box.appendChild(el('div', { style: 'display:flex;gap:8px;align-items:baseline;flex-wrap:wrap' }, [
          el('span', { class: 'chip ' + b.cls, text: b.label + ' \u00b7 ' + g.length }),
          el('span', { class: 'hint', text: b.advice })
        ]));
        box.appendChild(el('p', { class: 'hint', style: 'margin:4px 0 0',
          text: g.map(function (r) {
            return (r.player.number ? r.player.number + ' ' : '') + r.player.name +
              ' (' + Math.round(r.mins.played) + ' min)';
          }).join(', ') }));
        host.appendChild(box);
      });
      if (!Object.keys(byBand).length || byBand.none) {
        host.appendChild(el('p', { class: 'hint', style: 'margin:0 0 10px',
          text: 'No team sheet on the last game, so there is nothing to band the squad by yet.' }));
      }
    }

    var bs = L.bandsFor(squad);
    host.appendChild(el('p', { class: 'hint', style: 'margin:8px 0 0' }, [
      el('span', { text: 'Thresholds for this team: under ' + bs[0].max + ' needs volume, over ' +
        bs[1].max + ' needs managing, from a ' + L.gameLength(squad) + ' minute game. ' }),
      el('a', { href: 'plans.html', text: 'Change them' })
    ]));
    host.appendChild(el('p', { class: 'eyebrow', style: 'margin:16px 0 6px', text: 'Minutes this season' }));
    var max = Math.max.apply(null, season.map(function (r) { return r.played; }).concat([1]));
    var rows2 = el('div', { class: 'plrows' });
    season.forEach(function (r) {
      var pct = Math.round(r.played / max * 100);
      rows2.appendChild(el('div', { class: 'plrow' }, [
        el('span', { class: 'pn', text: (r.player.number ? r.player.number + ' ' : '') + r.player.name }),
        el('span', { class: 'bar' }, [el('i', { style: 'width:' + pct + '%' })]),
        el('span', { class: 'pv', text: Math.round(r.played) + ' min \u00b7 ' + r.starts + ' start' +
          (r.starts === 1 ? '' : 's') + ' \u00b7 ' + r.apps + ' app' + (r.apps === 1 ? '' : 's') +
          (r.share === null ? '' : ' \u00b7 ' + Math.round(r.share * 100) + '%') })
      ]));
    });
    host.appendChild(rows2);
    var unused = season.filter(function (r) { return r.apps === 0; });
    if (unused.length) {
      host.appendChild(el('p', { class: 'hint', style: 'margin-top:8px' }, [
        el('strong', { text: unused.length + ' with no minutes: ' }),
        el('span', { text: unused.map(function (r) { return r.player.name; }).join(', ') })
      ]));
    }
  }

  function refreshSoft() { ribbon(); stats(); }

  function fillBlockSel() {
    var bs = document.getElementById('blockSel');
    bs.innerHTML = '';
    bs.appendChild(el('option', { value: 'all', text: 'Whole season' }));
    S.planBlocks(squad).forEach(function (b) {
      bs.appendChild(el('option', { value: b.name, text: b.name + ' · ' + S.fmt(b.start) + ' to ' + S.fmt(b.end) }));
    });
    bs.value = 'all';
  }

  /* ---------- export ---------- */
  function csv() {
    var head = ['Cycle', 'Week', 'Day', 'Date', 'GD', 'Event Type', 'Cancel Reason', 'Duration', 'Notes',
      'Training Load', 'Moment', 'Phase', 'Principle', 'Team Focus',
      'Player Action 1', 'Player Action 2', 'Player Action 3', 'Player Action 4',
      'Game size', 'Delivered by', 'Absence reason', 'Readiness', 'Session Status'];
    var sessions = {};
    S.sessionList().forEach(function (s) {
      if (s.squad !== squad) return;
      /* two sessions on one date: the submitted one is the one to report */
      if (!sessions[s.date] || (S.isComplete(s) && !S.isComplete(sessions[s.date]))) sessions[s.date] = s;
    });
    var rows = [head];
    var lastBlock = null, lastWeek = null;
    S.days(squad).forEach(function (r) {
      var p = S.principle(r.principle);
      var pa = r.pa || [r.pa1 || '', r.pa2 || '', '', ''];
      rows.push([
        r.block === lastBlock ? '' : r.block,
        r.week === lastWeek ? '' : 'Week ' + r.week,
        r.dow, r.date, r.gd, r.event, r.cancelReason || '', r.duration, r.notes || r.opp || '', r.rpe,
        r.moment || '', r.phase || '',
        p ? '[' + p.clubCode + '] ' + (p.clubName || p.name) : (r.principle || ''),
        r.focus || '', pa[0] || '', pa[1] || '', pa[2] || '', pa[3] || '',
        r.gameSize || '',
        r.coveredBy || (r.event === 'Training Session' ? 'Me' : ''), r.absenceReason || '',
        (function () { var so = sessions[r.date]; if (!so) return ''; var rr = readinessOf(so);
          return rr.polled ? rr.score.toFixed(1) : ''; })(),
        sessions[r.date] ? (S.isComplete(sessions[r.date]) ? 'Complete' : 'Draft') : ''
      ]);
      lastBlock = r.block; lastWeek = r.week;
    });
    S.download('Periodization_' + S.planLabel(squad).replace(/[^\w-]+/g, '_') + '.csv', S.toCSV(rows), 'text/csv');
  }

  /* Everything this browser holds, not a named subset. Anything stored under the
     app's prefix travels, so a backup restored in another browser or on another
     machine is the whole thing rather than the sessions and nothing else. */
  function everyKey() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('ncfc.') === 0) out.push(k);
    }
    return out.sort();
  }
  function backup() {
    var store = {};
    everyKey().forEach(function (k) { store[k] = localStorage.getItem(k); });
    var bytes = Object.keys(store).reduce(function (a, k) { return a + store[k].length; }, 0);
    S.download('SessionBoard_backup_' + S.todayISO() + '.json', JSON.stringify({
      version: 3, exported: new Date().toISOString(),
      app: 'Session Board', origin: location.origin,
      keys: Object.keys(store).length, bytes: bytes,
      store: store
    }, null, 1));
    S.toast(Object.keys(store).length + ' stores backed up, ' + Math.round(bytes / 1024) + ' KB.');
  }
  /* A seed is a backup with a name, saved as seed.json beside the app. Deploy it
     with the folder and a new browser starts with everything already in it. */
  function makeSeed() {
    var name = prompt('Name this starting data', 'NCFC Youth, ' + S.todayISO());
    if (!name) return;
    var store = {};
    everyKey().forEach(function (k) {
      if (k === (window.Seed && window.Seed.MARK)) return;
      store[k] = localStorage.getItem(k);
    });
    S.download('seed.json', JSON.stringify({
      version: 3, seed: true, name: name.trim(), exported: new Date().toISOString(),
      keys: Object.keys(store).length, store: store
    }, null, 1));
    S.toast('seed.json built. Put it beside index.html and a fresh browser starts with all of this. ' +
      'Leave it out of the copy you share.');
  }

  function restore() {
    S.pickFile('.json', function (text) {
      var j;
      try { j = JSON.parse(text); } catch (e) { S.toast('That file is not valid JSON.'); return; }

      /* version 3 carries every store; earlier backups carried four, and are
         still restored so an old file is never refused */
      if (j.store && typeof j.store === 'object') {
        var n = Object.keys(j.store).length;
        var from = j.origin && j.origin !== location.origin ? '\n\nIt was made on ' + j.origin +
          ', which is fine: it will land here.' : '';
        if (!confirm('Restore ' + n + ' stores from ' + (j.exported || '').slice(0, 10) +
          '?\n\nEverything in this browser is replaced.' + from)) return;
        everyKey().forEach(function (k) { localStorage.removeItem(k); });
        var failed = 0;
        Object.keys(j.store).forEach(function (k) {
          try { localStorage.setItem(k, j.store[k]); } catch (e) { failed++; }
        });
        S.toast(failed ? (n - failed) + ' restored, ' + failed + ' would not fit'
          : n + ' stores restored.');
        setTimeout(function () { location.reload(); }, 900);
        return;
      }

      if (!j.sessions && !j.plan) { S.toast('That is not a Session Board backup.'); return; }
      if (!confirm('This is an older backup and carries sessions and plan edits only.\n\nRestore it?')) return;
      localStorage.setItem(S.K_SESS, JSON.stringify(j.sessions || {}));
      localStorage.setItem(S.K_PLAN, JSON.stringify(j.plan || {}));
      if (j.plans) localStorage.setItem(S.K_CUSTOM, JSON.stringify(j.plans));
      S.toast('Older backup restored.');
      location.reload();
    });
  }

  function clearCounts() {
    var c = S.countFor(squad);
    document.getElementById('clearCounts').textContent =
      S.planLabel(squad) + ' currently holds ' + c.edits + ' edited row' + (c.edits === 1 ? '' : 's') +
      ' and ' + c.sessions + ' saved session' + (c.sessions === 1 ? '' : 's') + ' (drafts included).';
  }

  function wireClearing() {
    document.getElementById('btnClearRows').addEventListener('click', function () {
      var c = S.countFor(squad);
      if (!c.edits) { S.toast('No row edits to clear on this plan.'); return; }
      if (!confirm('Clear ' + c.edits + ' edited row' + (c.edits === 1 ? '' : 's') + ' on ' + S.planLabel(squad) + '?\n\n' +
        'The calendar itself stays. Your sequencing, focuses and notes go.')) return;
      S.clearPlanEdits(squad); S.toast('Row edits cleared.'); draw();
    });

    document.getElementById('btnClearSessions').addEventListener('click', function () {
      var c = S.countFor(squad);
      if (!c.sessions) { S.toast('No sessions saved against this plan.'); return; }
      if (!confirm('Delete ' + c.sessions + ' session' + (c.sessions === 1 ? '' : 's') + ' saved against ' +
        S.planLabel(squad) + ', drafts included?')) return;
      S.clearSessions(squad); S.toast('Sessions deleted.'); draw();
    });

    document.getElementById('btnClearPlan').addEventListener('click', function () {
      var c = S.countFor(squad);
      if (!c.edits && !c.sessions) { S.toast('This plan is already empty.'); return; }
      if (!confirm('Empty ' + S.planLabel(squad) + ' completely?\n\n' +
        c.edits + ' row edit(s) and ' + c.sessions + ' session(s) will be deleted. The calendar stays.')) return;
      S.clearPlanEdits(squad); S.clearSessions(squad);
      S.toast('Plan emptied. The calendar is untouched.'); draw();
    });

    document.getElementById('btnFactory').addEventListener('click', function () {
      var all = S.countFor(null);
      var custom = Object.keys(S.customPlans()).length;
      if (!confirm('Reset everything?\n\nThis deletes ' + all.sessions + ' session(s), ' + all.edits +
        ' row edit(s) and ' + custom + ' plan(s) you built, across every plan.')) return;
      if (!confirm('Last check. Have you exported a backup?\n\nPress OK only if you have, or if you do not need one.')) return;
      S.resetAll(); S.toast('Everything reset.');
      setTimeout(function () { location.reload(); }, 700);
    });
  }

  function draw() {
    ribbon(); stats(); coverage();
    fillFeedbackPickers(); renderFeedback(); renderFbTrend();
    renderCycles(); renderMinutes(); table(); clearCounts();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var fd = document.getElementById('fbDate');
    if (fd) fd.addEventListener('change', function () { fbDate = this.value; renderFeedback(); });

    var q = new URLSearchParams(location.search);
    if (q.get('plan') && S.planExists(q.get('plan'))) { squad = q.get('plan'); S.setPref('squad', squad); }

    var ss = document.getElementById('squadSel');
    S.planList().forEach(function (p) { ss.appendChild(el('option', { value: p.id, text: p.short })); });
    ss.value = squad;
    ss.addEventListener('change', function () {
      squad = ss.value; S.setPref('squad', squad); blockFilter = 'all'; fillBlockSel(); draw();
    });

    fillBlockSel();
    document.getElementById('blockSel').addEventListener('change', function () {
      blockFilter = this.value; table();
    });
    wireClearing();

    document.getElementById('btnCsv').addEventListener('click', csv);
    document.getElementById('btnBackup').addEventListener('click', backup);
    document.getElementById('btnRestore').addEventListener('click', restore);
    var ms = document.getElementById('btnSeed');
    if (ms) ms.addEventListener('click', makeSeed);
    document.getElementById('btnPrint').addEventListener('click', function () { window.print(); });

    draw();
  });
})();

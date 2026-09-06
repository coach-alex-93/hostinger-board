/* ============================================================
   home.js
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el;
  var squad = S.defaultPlanId();

  function ribbon() {
    var rows = S.days(squad);
    var host = document.getElementById('ribbon');
    var axis = document.getElementById('axis');
    host.innerHTML = ''; axis.innerHTML = '';
    /* a day is marked once a session for it has been submitted; a draft is
       marked differently, because it is started rather than written */
    var state = {};
    S.sessionList().forEach(function (s) {
      if (s.squad !== squad) return;
      if (S.isComplete(s)) state[s.date] = 'planned';
      else if (state[s.date] !== 'planned') state[s.date] = 'drafted';
    });
    var today = S.todayISO();

    rows.forEach(function (r) {
      var c = r.event === 'Training Session' ? 'train'
        : (r.event.indexOf('Game') === 0 ? 'game' : (/^OFF/.test(r.event) ? '' : 'other'));
      var h = r.event === 'Training Session' ? (r.mins === 90 ? 88 : 68)
        : (r.event.indexOf('Game') === 0 ? 100 : (/^OFF/.test(r.event) ? 22 : 55));
      host.appendChild(el('div', {
        class: 'sr-day ' + c + (state[r.date] ? ' ' + state[r.date] : '') + (r.date === today ? ' istoday' : ''),
        style: 'height:' + h + '%',
        title: S.dow(r.date) + ' ' + S.fmt(r.date) + ' · ' + r.event + (r.opp ? ' v ' + r.opp : '') +
          (r.date === today ? ' · today' : '') +
          (state[r.date] === 'planned' ? ' · session written'
            : (state[r.date] === 'drafted' ? ' · session in draft' : ''))
      }));
    });

    S.planBlocks(squad).forEach(function (b) {
      var n = rows.filter(function (r) { return r.date >= b.start && r.date <= b.end; }).length;
      axis.appendChild(el('div', { class: 'sr-blk', style: 'flex:' + n + ' 1 0', text: b.name + ' · ' + S.fmt(b.start) }));
    });
    var rt = document.getElementById('ribTitle');
    if (rt) rt.textContent = S.planLabel(squad);
    var lg = document.getElementById('ribLegend');
    if (lg) {
      lg.innerHTML = '';
      [['train', 'Training'], ['game', 'Game'], ['cancelled', 'Cancelled'],
       ['planned', 'Session written'], ['drafted', 'Session in draft'],
       ['istoday', 'Today']].forEach(function (x) {
        lg.appendChild(el('span', { style: 'display:inline-flex;align-items:center;gap:6px' }, [
          el('span', { class: 'sr-day ' + x[0], style: 'height:14px;width:12px;flex:0 0 12px' }),
          el('span', { text: x[1] })
        ]));
      });
    }
  }

  function stats() {
    var rows = S.days(squad), today = S.todayISO();
    var left = rows.filter(function (r) { return r.event === 'Training Session' && r.date >= today; }).length;
    var games = rows.filter(function (r) { return r.event.indexOf('Game') === 0; })
      .reduce(function (s, r) { return s + (r.games || 1); }, 0);
    var tally = S.sessionTally(squad);
    var seq = rows.filter(function (r) { return r.principle; }).length;
    var host = document.getElementById('stats');
    host.innerHTML = '';
    [[left, 'Training days left'], [games, 'Games this fall'],
     [tally.complete, 'Sessions written', tally.draft ? tally.draft + ' more in draft' : ''],
     [seq, 'Days sequenced', 'from the periodization plan']]
      .forEach(function (x) {
        host.appendChild(el('div', { class: 'stat' }, [
          el('b', { text: String(x[0]) }), el('span', { text: x[1] }),
          x[2] ? el('span', { class: 'hint',
            style: 'font-size:11px;letter-spacing:0;text-transform:none', text: x[2] }) : null
        ]));
      });
  }

  function next() {
    var host = document.getElementById('next');
    host.innerHTML = '';
    var ul = el('ul', { class: 'list' });
    S.planList().map(function (p) { return p.id; }).forEach(function (sq) {
      var t = S.nextTraining(sq), g = S.nextGame(sq);
      if (t) {
        var has = S.sessionsOn(t.date, sq)[0];
        var p = S.principle(t.principle);
        ul.appendChild(el('li', {}, [
          el('span', { class: 'chip', text: S.planLabel(sq) }),
          el('div', { class: 'grow' }, [
            el('div', { class: 'ttl', text: 'Training · ' + S.dow(t.date) + ' ' + S.fmt(t.date) + ' · ' + t.duration }),
            el('div', { class: 'sub', text: [t.block, t.gd, t.rpe, p ? p.code + ' ' + p.name : 'no principle set'].filter(Boolean).join(' · ') })
          ]),
          el('a', {
            class: 'btn ' + (has && S.isComplete(has) ? 'ghost' : 'turf') + ' sm',
            href: has ? 'planner.html?id=' + encodeURIComponent(has.id) : 'planner.html?date=' + t.date + '&squad=' + sq + (t.principle ? '&principle=' + t.principle : ''),
            text: has ? (S.isComplete(has) ? 'Open session' : 'Finish the draft') : 'Write it'
          })
        ]));
      }
      if (g) {
        ul.appendChild(el('li', {}, [
          el('span', { class: 'chip game', text: S.planLabel(sq) }),
          el('div', { class: 'grow' }, [
            el('div', { class: 'ttl', text: (g.opp ? 'v ' + g.opp : 'Game') + ' · ' + S.dow(g.date) + ' ' + S.fmt(g.date) }),
            el('div', { class: 'sub', text: [g.event, g.venue, g.comp].filter(Boolean).join(' · ') })
          ])
        ]));
      }
    });
    if (!ul.children.length) ul.appendChild(el('li', {}, [el('div', { class: 'grow', text: 'Nothing left on the fall calendar.' })]));
    host.appendChild(ul);
  }

  function recent() {
    var host = document.getElementById('recent');
    var list = S.sessionList().slice(0, 12);
    host.innerHTML = '';
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty', text: 'No sessions yet. Start one from a training day on the periodization plan, or hit New session.' }));
      return;
    }
    var ul = el('ul', { class: 'list' });
    list.forEach(function (s) {
      var p = S.principle(s.principleCode);
      var mins = (s.acts || []).reduce(function (t, a) {
        var v = parseFloat(a.ttlDur);
        if (!isFinite(v) || v <= 0) {
          var sets = Math.max(1, parseFloat(a.sets) || 1);
          v = (parseFloat(a.workDur) || 0) * sets + (parseFloat(a.restDur) || 0) * sets + (parseFloat(a.restBtw) || 0) * (sets - 1);
        }
        return t + v;
      }, 0);
      ul.appendChild(el('li', {}, [
        el('span', { class: 'chip ' + (p ? S.momentKey(p.moment) : ''), text: S.planLabel(s.squad) }),
        el('span', { class: 'chip ' + S.statusChip(s), text: S.statusLabel(s) }),
        el('div', { class: 'grow' }, [
          el('div', { class: 'ttl', text: S.dow(s.date) + ' ' + S.fmt(s.date) + (p ? ' · ' + p.code + ' ' + p.name : '') }),
          el('div', { class: 'sub', text: [(s.acts || []).length + ' activities', mins + ' min planned', s.duration + ' min booked'].join(' · ') })
        ]),
        el('a', { class: 'btn ghost sm', href: 'planner.html?id=' + encodeURIComponent(s.id), text: 'Open' })
      ]));
    });
    host.appendChild(ul);
  }

  /* ---------- the hub ----------
     A season plan is a team plus everything you do with it. The tactics board
     and coach observation sit outside, because neither belongs to one squad. */
  var TEAM_TOOLS = [
    ['periodization.html', 'Periodization', 'The calendar: blocks, GD, load, what is sequenced when'],
    ['planner.html', 'Session planner', 'Write and print a session'],
    ['kpi.html', 'KPIs', 'Targets, the field tally, who is succeeding'],
    ['review.html', 'Review', 'What you planned against what happened'],
    ['idp.html', 'IDP', 'A development sheet per player'],
    ['depth.html', 'Depth chart', 'Ranked by position, with ages'],
    ['lineups.html', 'Team sheets', 'Starting XI, minutes, and what the week asks of each player']
  ];
  var ANALYSIS = [
    ['board.html', 'Tactics board', 'A pitch and tools. Draw a shape, a rotation, a pressing picture'],
    ['analysis.html', 'Game analysis', 'Freeze a clip, draw on it, classify what happened'],
    ['scout.html', 'Scouting', 'Count a whole game; enough of them become a benchmark'],
    ['gallery.html', 'Coach observation', 'Watching another coach, with a timed intervention log']
  ];
  /* one page, so one door. The old four tiles all opened the same page at
     different scroll positions, which read as four things and was one. */
  var MODEL = [
    ['model.html', 'Game model', 'Identity, style of play, formations, principles and the profiles they imply']
  ];
  var SETUP = [
    ['library.html', 'Activity library', 'Everything you have saved, grouped by what it is for'],
    ['lists.html', 'Lists', 'Every dropdown in the app, in one place'],
    ['plans.html', 'Plans', 'Create, copy and share season plans'],
    ['#shortcuts', 'Header shortcuts', 'Which pages sit in the header, and your initials']
  ];

  function tile(href, title, blurb, badge) {
    var a = el('a', { class: 'hubtile', href: href });
    a.appendChild(el('b', { text: title }));
    if (badge) a.appendChild(el('span', { class: 'chip', text: badge }));
    a.appendChild(el('span', { class: 'hint', text: blurb }));
    return a;
  }

  function hubLists() {
    var an = document.getElementById('analysis');
    if (an) { an.innerHTML = ''; ANALYSIS.forEach(function (t) { an.appendChild(tile(t[0], t[1], t[2])); }); }
    var gm = document.getElementById('gamemodel');
    if (gm) {
      gm.innerHTML = '';
      MODEL.forEach(function (t) {
        var badge = '';
        var np = 0;
        try { np = (JSON.parse(localStorage.getItem('ncfc.profiles.v1') || 'null') || window.PROFILES || []).length; } catch (e) {}
        badge = ((window.PRINCIPLES || []).length) + ' principles \u00b7 ' + np + ' positions';
        gm.appendChild(tile(t[0], t[1], t[2], badge));
      });
    }
    var st = document.getElementById('setup');
    if (st) {
      st.innerHTML = '';
      SETUP.forEach(function (t) {
        var badge = '';
        if (t[0] === 'model.html') badge = ((window.PRINCIPLES || []).length) + ' principles';
        if (t[0] === 'plans.html') badge = S.planList().length + ' plans';
        if (t[0] === '#shortcuts') badge = (window.Nav ? window.Nav.shown().length : 0) + ' in the header';
        if (t[0] === 'library.html') {
          var na = 0;
          try { na = Object.keys(JSON.parse(localStorage.getItem('ncfc.activities.v1') || '{}')).length; } catch (e) {}
          badge = na + ' activit' + (na === 1 ? 'y' : 'ies');
        }
        var node = tile(t[0], t[1], t[2], badge);
        if (t[0] === '#shortcuts') node.addEventListener('click', function (e) {
          e.preventDefault();
          if (window.Nav) window.Nav.panel();
        });
        st.appendChild(node);
      });
    }
  }

  function plansPanel() {
    var host = document.getElementById('plans');
    if (!host) return;
    host.innerHTML = '';
    var list = S.planList();
    if (!list.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('span', { text: 'No season plan yet. ' }),
        el('a', { href: 'plans.html', text: 'Create one' }),
        el('span', { text: ' and everything else follows from it.' })
      ]));
      return;
    }
    list.forEach(function (p) {
      var rows = S.planRows(p.id);
      var train = rows.filter(function (r) { return r.event === 'Training Session'; }).length;
      var games = rows.reduce(function (s2, r) { return s2 + (r.games || 0); }, 0);
      var coaches = S.planCoaches(p.id);
      var next = S.nextTraining(p.id);

      var box = el('section', { class: 'planbox' });
      var hd = el('div', { class: 'planhd' });
      hd.appendChild(el('b', { text: p.short }));
      coaches.forEach(function (c) {
        hd.appendChild(el('span', { class: 'chip ' + (c.role === 'Head' ? 'ao' : ''), text: c.name + (c.role ? ' \u00b7 ' + c.role : '') }));
      });
      hd.appendChild(el('span', { class: 'sp', style: 'margin-left:auto' }));
      hd.appendChild(el('button', { class: 'btn ghost sm', text: coaches.length ? 'Coaches' : 'Assign a coach',
        onclick: function () { editCoaches(p.id); } }));
      box.appendChild(hd);

      box.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 10px',
        text: [train + ' training days', games + ' games', S.tallyWords(p.id),
          next ? 'next ' + S.dow(next.date) + ' ' + S.fmt(next.date) : 'season finished'].join('  \u00b7  ') }));

      var grid = el('div', { class: 'hubgrid' });
      TEAM_TOOLS.forEach(function (t) {
        var href = t[0] + (['periodization.html', 'lineups.html'].indexOf(t[0]) >= 0
          ? '?plan=' + encodeURIComponent(p.id) : '');
        grid.appendChild(tile(href, t[1], t[2]));
      });
      box.appendChild(grid);
      host.appendChild(box);
    });
  }

  function editCoaches(planId) {
    var list = S.planCoaches(planId).slice();
    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var card = el('div', { class: 'card', style: 'max-width:520px;width:100%' });
    card.appendChild(el('div', { class: 'card-hd' }, [el('h2', { text: 'Coaches on ' + S.planLabel(planId) })]));
    var bd = el('div', { class: 'card-bd' });
    var rows = el('div');
    function drawRows() {
      rows.innerHTML = '';
      if (!list.length) rows.appendChild(el('p', { class: 'hint', style: 'margin:0', text: 'Nobody assigned yet.' }));
      list.forEach(function (c, i) {
        var nm = el('input', { type: 'text', value: c.name || '', placeholder: 'Name' });
        nm.addEventListener('input', function () { c.name = nm.value; });
        var role = el('select');
        ['Head', 'Assistant', 'Goalkeeping', 'Analyst', 'Cover'].forEach(function (r) {
          role.appendChild(el('option', { value: r, text: r }));
        });
        role.value = c.role || 'Assistant';
        role.addEventListener('change', function () { c.role = role.value; });
        rows.appendChild(el('div', { class: 'grid g3', style: 'margin-bottom:8px;align-items:end' }, [
          el('label', { class: 'f' }, [el('span', { text: 'Name' }), nm]),
          el('label', { class: 'f' }, [el('span', { text: 'Role' }), role]),
          el('button', { class: 'btn warn sm', text: 'Remove',
            onclick: function () { list.splice(i, 1); drawRows(); } })
        ]));
      });
    }
    drawRows();
    bd.appendChild(rows);
    bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:12px' }, [
      el('button', { class: 'btn ghost sm', text: '+ Add a coach',
        onclick: function () { list.push({ name: '', role: 'Assistant' }); drawRows(); } }),
      el('button', { class: 'btn turf', text: 'Save', onclick: function () {
        var clean = list.filter(function (c) { return (c.name || '').trim(); });
        var id = S.setPlanCoaches(planId, clean);
        back.remove();
        if (id !== planId) S.toast('That plan ships with the app, so a copy was made to hold the coaches.');
        draw();
      } })
    ]));
    bd.appendChild(el('p', { class: 'hint', style: 'margin-top:12px',
      text: 'Assigning a coach records who runs the team. It does not give anyone access: this site has no accounts, so sharing means sending them their own copy.' }));
    card.appendChild(bd); back.appendChild(card);
    document.body.appendChild(back);
  }

  function draw() { hubLists(); plansPanel(); ribbon(); stats(); next(); recent(); }

  document.addEventListener('DOMContentLoaded', function () {
    /* a fresh browser with a seed file beside the app picks it up once */
    if (window.Seed) {
      window.Seed.autoload(function (loaded, j, n) {
        if (!loaded) return;
        var bar = document.createElement('div');
        bar.className = 'secbar no-print';
        bar.textContent = (j.name || 'Starting data') + ' loaded: ' + n +
          ' stores, from the seed file next to the app. It only happens on an empty browser.';
        var main = document.querySelector('main');
        if (main) main.insertBefore(bar, main.firstChild);
        draw();
      });
    }
    var st2 = document.getElementById('stamp');
    if (st2) st2.textContent = S.dow(S.todayISO()) + ' ' + S.fmt(S.todayISO());
    var sel = document.getElementById('planSel');
    S.planList().forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: p.short })); });
    sel.value = squad;
    sel.addEventListener('change', function () { squad = sel.value; S.setPref('squad', squad); draw(); });
    draw();
  });
})();

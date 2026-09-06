/* ============================================================
   nav.js — tab visibility
   The nav has outgrown one line. Hide what you are not using;
   the page itself still works if you reach it by URL, so nothing
   is lost, only tidied away.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.nav.v1';
  var TABS = [
    { href: 'hub.html', label: 'Hub', fixed: true },
    { href: 'periodization.html', label: 'Periodization' },
    { href: 'planner.html', label: 'Session planner' },
    { href: 'kpi.html', label: 'KPIs' },
    { href: 'model.html', label: 'Game model' },
    { href: 'board.html', label: 'Tactics board' },
    { href: 'lineups.html', label: 'Team sheets' },
    { href: 'analysis.html', label: 'Game analysis' },
    { href: 'scout.html', label: 'Scouting' },
    { href: 'model.html#profiles', label: 'Profiles' },
    { href: 'review.html', label: 'Review' },
    { href: 'gallery.html', label: 'Coach observation' },
    { href: 'idp.html', label: 'IDP' },
    { href: 'depth.html', label: 'Depth chart' },
    { href: 'library.html', label: 'Activity library' },
    { href: 'lists.html', label: 'Lists' },
    { href: 'plans.html', label: 'Plans' }
  ];

  /* The hub is the way in. The header starts bare and you pin what you
     want on it, rather than carrying twelve tabs everywhere. */
  var DEFAULT_HIDDEN = TABS.filter(function (t) { return !t.fixed; }).map(function (t) { return t.href; });
  /* Nothing is in the header until you put it there. The hub is the way
     around; tabs are a shortcut you opt into, chosen under Setup. */
  function shown() {
    try {
      var v = JSON.parse(localStorage.getItem(K) || 'null');
      if (v && Array.isArray(v.shown)) return v.shown;
    } catch (e) {}
    return [];
  }
  function setShown(list) {
    try { localStorage.setItem(K, JSON.stringify({ shown: list })); } catch (e) {}
  }
  function isShown(href) { return shown().indexOf(href) >= 0; }

  function labelFor(href) {
    var t = TABS.filter(function (x) { return x.href === href; })[0];
    return t ? t.label : href.replace('.html', '');
  }

  /* which squad this page is working on, so two teams never blur into one */
  function context() {
    var S = w.Store;
    if (!S || !S.planList) return null;
    var id = '';
    try {
      var q = new URLSearchParams(location.search);
      id = q.get('plan') || q.get('squad') || (S.prefs() || {}).squad || '';
    } catch (e) {}
    if (!id || !S.planExists(id)) return null;
    var cfg = S.planConfig(id) || {};
    var coaches = (S.planCoaches && S.planCoaches(id)) || [];
    var head = coaches.filter(function (c) { return c.role === 'Head'; })[0];
    return { id: id, label: S.planLabel(id),
      dates: cfg.start ? S.fmt(cfg.start) + ' to ' + S.fmt(cfg.end) : '',
      head: head ? head.name : '' };
  }

  function build() {
    var bar = document.querySelector('.topbar-in');
    if (!bar) return;
    var nav = bar.querySelector('.nav');
    if (!nav) return;
    var here = (location.pathname.split('/').pop() || 'hub.html');

    /* the mark is your initials, not a badge */
    var mark = bar.querySelector('.wordmark');
    if (mark) {
      var S = w.Store;
      var ini = (S && (S.prefs() || {}).initials) || 'AE';
      mark.innerHTML = '';
      mark.appendChild(Object.assign(document.createElement('span'),
        { className: 'initials', textContent: ini }));
      mark.setAttribute('aria-label', 'Hub');
      mark.setAttribute('href', 'hub.html');
      mark.title = 'Hub';
    }

    nav.innerHTML = '';
    var s = shown();
    TABS.forEach(function (t) {
      if (t.href !== here && s.indexOf(t.href) < 0) return;
      if (t.href === 'hub.html' && here === 'hub.html') return;
      var a = document.createElement('a');
      a.href = t.href;
      a.textContent = t.label;
      if (t.href === here) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });

    /* where you are, and on whose behalf */
    var ctx = bar.querySelector('.wherebar');
    if (ctx) ctx.remove();
    var c = context();
    var box = document.createElement('div');
    box.className = 'wherebar';
    /* the page name is also the way to the next page, so the hub is a choice
       rather than a stop on every journey */
    var pg = document.createElement('select');
    pg.className = 'pagesel';
    TABS.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.href;
      o.textContent = t.label;
      pg.appendChild(o);
    });
    pg.value = here;
    pg.addEventListener('change', function () {
      var u = new URL(pg.value, location.href);
      var cur = new URL(location.href);
      ['plan', 'squad'].forEach(function (k) {
        if (cur.searchParams.has(k)) u.searchParams.set(k, cur.searchParams.get(k));
      });
      location.href = u.toString();
    });
    box.appendChild(pg);
    if (c) {
      /* the squad you are working on, switchable from anywhere, and it carries
         to the next page so two teams cannot blur into one */
      var list = w.Store.planList();
      var sq = document.createElement('select');
      sq.className = 'teamsel';
      sq.setAttribute('aria-label', 'Team you are working on');
      list.forEach(function (pl) {
        var o = document.createElement('option');
        o.value = pl.id; o.textContent = pl.short;
        sq.appendChild(o);
      });
      sq.value = c.id;
      sq.title = [c.dates, c.head && 'Head coach ' + c.head].filter(Boolean).join(' · ');
      sq.addEventListener('change', function () {
        w.Store.setPref('squad', sq.value);
        var u = new URL(location.href);
        ['plan', 'squad'].forEach(function (k) { if (u.searchParams.has(k)) u.searchParams.set(k, sq.value); });
        u.searchParams.delete('id');          // a session belongs to the old team
        location.href = u.toString();
      });
      box.appendChild(sq);
    } else if (here !== 'hub.html' && here !== 'plans.html') {
      var no = document.createElement('span');
      no.className = 'chip off';
      no.textContent = 'no team selected';
      box.appendChild(no);
    }
    nav.parentNode.insertBefore(box, nav.nextSibling);
  }

  function panel() {
    var back = document.createElement('div');
    back.className = 'modal';
    back.addEventListener('click', function (e) { if (e.target === back) back.remove(); });
    var card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'max-width:440px;width:100%';
    card.innerHTML = '<div class="card-hd"><h2>Header shortcuts</h2></div>';
    var bd = document.createElement('div');
    bd.className = 'card-bd';
    bd.innerHTML = '<p class="hint" style="margin:0 0 12px">The hub is the way around everything. ' +
      'Tick anything you want as a shortcut in the header as well. The page you are on always shows.</p>';
    var box = document.createElement('div');
    box.className = 'subs';
    box.style.maxHeight = '340px';
    var s = shown();
    TABS.forEach(function (t) {
      if (t.href === 'hub.html') return;
      var lab = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = s.indexOf(t.href) >= 0;
      cb.addEventListener('change', function () {
        var cur = shown();
        var i = cur.indexOf(t.href);
        if (cb.checked && i < 0) cur.push(t.href);
        if (!cb.checked && i >= 0) cur.splice(i, 1);
        setShown(cur);
        build();
      });
      lab.appendChild(cb);
      var sp = document.createElement('span');
      sp.textContent = t.label;
      lab.appendChild(sp);
      box.appendChild(lab);
    });
    bd.appendChild(box);

    var row = document.createElement('div');
    row.className = 'btnrow';
    row.style.marginTop = '14px';
    [['Clear them all', function () { setShown([]); build(); back.remove(); panel(); }],
     ['Done', function () { back.remove(); }]].forEach(function (x, i) {
      var b = document.createElement('button');
      b.className = i ? 'btn turf' : 'btn ghost sm';
      b.textContent = x[0];
      b.addEventListener('click', x[1]);
      row.appendChild(b);
    });
    bd.appendChild(row);

    var ini = document.createElement('input');
    ini.type = 'text'; ini.maxLength = 4;
    ini.value = (w.Store && (w.Store.prefs() || {}).initials) || 'AE';
    ini.addEventListener('input', function () {
      if (w.Store) w.Store.setPref('initials', ini.value.trim().toUpperCase());
      build();
    });
    var lb = document.createElement('label');
    lb.className = 'f';
    lb.style.marginTop = '16px';
    var lbs = document.createElement('span');
    lbs.textContent = 'Your initials, top left';
    lb.appendChild(lbs); lb.appendChild(ini);
    bd.appendChild(lb);

    card.appendChild(bd); back.appendChild(card);
    document.body.appendChild(back);
  }

  w.Nav = { build: build, panel: panel, TABS: TABS, shown: shown, setShown: setShown };
  document.addEventListener('DOMContentLoaded', build);
})(window);

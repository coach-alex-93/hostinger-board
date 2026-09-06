/* ============================================================
   kpi.js — KPI definitions and session tallies
   A KPI is defined once, against a principle. A session picks a
   few, sets a target, and tallies opportunity and success at the
   field. The review then compares target against what happened.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.kpis.v1';

  var UNITS = [
    { v: 'rate', label: 'Success rate', hint: 'successes out of opportunities, as a percentage' },
    { v: 'count', label: 'Count of successes', hint: 'how many times it came off' },
    { v: 'opps', label: 'Count of opportunities', hint: 'how often the situation appeared at all' }
  ];

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(K, JSON.stringify(d)); return true; }
    catch (e) { if (w.Store) w.Store.toast('Could not save the KPI.'); return false; }
  }
  function db() { var d = read(); d.defs = d.defs || {}; return d; }

  function all() {
    var d = db(), out = [];
    Object.keys(d.defs).forEach(function (k) { out.push(d.defs[k]); });
    out.sort(function (a, b) {
      return (a.principle || 'zz').localeCompare(b.principle || 'zz') ||
        (a.category || '').localeCompare(b.category || '');
    });
    return out;
  }
  function get(id) { return db().defs[id] || null; }
  function forPrinciple(code) {
    return all().filter(function (x) { return !code || x.principle === code; });
  }
  function save(def) {
    var d = db();
    if (!def.id) def.id = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    d.defs[def.id] = def;
    return write(d) ? def : null;
  }
  function remove(id) { var d = db(); delete d.defs[id]; write(d); }

  /* One starter KPI per principle, worded from the principle itself.
     Nothing is invented: the category is your principle name and the
     description is its teaching line and cue. */
  /* KPIs come out of the model rather than a stock list: one per principle, one
     per sub-principle, and one per position for what that role owes in each
     moment. Nothing already written is touched. */
  function existing(cat) {
    return all().some(function (k) { return (k.category || '').toLowerCase() === cat.toLowerCase(); });
  }

  function seedFromPrinciples(what) {
    what = what || { principles: true, subs: true, roles: true };
    var made = 0;

    if (what.principles) {
      (w.PRINCIPLES || []).forEach(function (p) {
        if (forPrinciple(p.code).length) return;
        save({ id: null, principle: p.code, category: (p.clubName || p.name),
          description: [p.teaching, p.cue ? 'Cue: ' + p.cue : ''].filter(Boolean).join(' \u00b7 '),
          moment: p.moment, unit: 'rate', seeded: true });
        made++;
      });
    }

    if (what.subs) {
      (w.PRINCIPLES || []).forEach(function (p) {
        var subs = (w.Lists && w.Lists.subsFor) ? w.Lists.subsFor(p.code) : (p.subs || []);
        subs.forEach(function (sp) {
          var cat = sp.code + '  ' + sp.text;
          if (existing(cat)) return;
          save({ id: null, principle: p.code, category: cat,
            description: 'Sub-principle of ' + p.clubCode + (sp.cue ? '. Cue: ' + sp.cue : ''),
            moment: p.moment, unit: 'rate', seeded: true });
          made++;
        });
      });
    }

    if (what.roles) {
      (w.PROFILES || []).forEach(function (pos) {
        Object.keys(pos.moments || {}).forEach(function (m) {
          (pos.moments[m] || []).slice(0, 3).forEach(function (line) {
            var cat = pos.code + '  ' + String(line).replace(/\.$/, '');
            if (cat.length > 78 || existing(cat)) return;
            save({ id: null, principle: '', category: cat,
              description: 'What a ' + (pos.name || pos.code) + ' owes in ' + m + '.',
              moment: m, position: pos.code, unit: 'rate', seeded: true });
            made++;
          });
        });
      });
    }
    return made;
  }

  /* ---------- tallies, stored on the session ---------- */
  function blankTally(kpiId) {
    return { id: kpiId, target: '', tOpps: '', tSucc: '', opps: 0, succ: 0, players: {}, note: '', evidence: '' };
  }
  /* A target set as "8 of 20" is easier to hold in your head than "40%".
     Either can be entered; the other follows. */
  function targetPct(t) {
    var o = parseFloat(t.tOpps), s2 = parseFloat(t.tSucc);
    if (isFinite(o) && o > 0 && isFinite(s2)) return Math.round(s2 / o * 1000) / 10;
    var d = parseFloat(t.target);
    return isFinite(d) ? d : null;
  }
  function targetLabel(t, unit) {
    var o = parseFloat(t.tOpps), s2 = parseFloat(t.tSucc);
    if (isFinite(o) && o > 0 && isFinite(s2)) return s2 + ' of ' + o + '  (' + targetPct(t) + '%)';
    var d = parseFloat(t.target);
    if (!isFinite(d)) return '';
    return unit === 'rate' ? d + '%' : String(d);
  }
  function rate(t) {
    if (!t || !t.opps) return null;
    return t.succ / t.opps;
  }
  function actual(t, unit) {
    if (unit === 'count') return t.succ;
    if (unit === 'opps') return t.opps;
    var r = rate(t);
    return r === null ? null : Math.round(r * 1000) / 10;
  }
  function met(t, unit) {
    var target = unit === 'rate' ? targetPct(t) : parseFloat(t.target);
    if (target === null || !isFinite(target)) return null;
    var a = actual(t, unit);
    if (a === null) return null;
    return a >= target;
  }
  function fmtActual(t, unit) {
    var a = actual(t, unit);
    if (a === null) return '-';
    return unit === 'rate' ? a + '%  (' + t.succ + ' of ' + t.opps + ')' : String(a);
  }

  /* ---------- per player ----------
     A KPI asks whether players are succeeding, so the player breakdown is
     the point rather than a footnote. Team totals are the context. */
  function playerRows(t) {
    var out = [];
    Object.keys(t.players || {}).forEach(function (pid) {
      var p = t.players[pid];
      if (!p.opps && !p.succ) return;
      out.push({ id: pid, opps: p.opps || 0, succ: p.succ || 0,
        rate: p.opps ? p.succ / p.opps : null });
    });
    out.sort(function (a, b) {
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return b.rate - a.rate || b.opps - a.opps;
    });
    return out;
  }

  /* every player who has been counted against this KPI, across every session */
  function playerTotals(kpiId, planId) {
    var agg = {};
    if (!w.Store) return [];
    w.Store.sessionList().forEach(function (s) {
      if (planId && s.squad !== planId) return;
      (s.kpis || []).forEach(function (t) {
        if (t.id !== kpiId) return;
        Object.keys(t.players || {}).forEach(function (pid) {
          var p = t.players[pid];
          agg[pid] = agg[pid] || { id: pid, opps: 0, succ: 0, sessions: 0 };
          agg[pid].opps += p.opps || 0;
          agg[pid].succ += p.succ || 0;
          if (p.opps || p.succ) agg[pid].sessions++;
        });
      });
    });
    var out = Object.keys(agg).map(function (k) {
      var a = agg[k];
      a.rate = a.opps ? a.succ / a.opps : null;
      return a;
    });
    out.sort(function (a, b) { return (b.rate || 0) - (a.rate || 0) || b.opps - a.opps; });
    return out;
  }

  /* how much of the team's count this player was involved in */
  function share(t, pid) {
    var p = (t.players || {})[pid];
    if (!p || !t.opps) return null;
    return (p.opps || 0) / t.opps;
  }

  /* every session that tallied this KPI, oldest first */
  function history(kpiId) {
    if (!w.Store) return [];
    return w.Store.sessionList().filter(function (s) {
      return (s.kpis || []).some(function (t) { return t.id === kpiId && t.opps; });
    }).sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); })
      .map(function (s) {
        var t = s.kpis.filter(function (x) { return x.id === kpiId; })[0];
        return { date: s.date, squad: s.squad, sessionId: s.id, t: t };
      });
  }

  w.KPI = {
    all: all, get: get, forPrinciple: forPrinciple, save: save, remove: remove,
    seedFromPrinciples: seedFromPrinciples, blankTally: blankTally,
    rate: rate, actual: actual, met: met, fmtActual: fmtActual, history: history,
    targetPct: targetPct, targetLabel: targetLabel,
    playerRows: playerRows, playerTotals: playerTotals, share: share,
    UNITS: UNITS, KEY: K
  };
})(window);

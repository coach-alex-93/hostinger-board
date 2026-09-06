/* ============================================================
   lists.js — one place every dropdown reads from.
   A list is whatever ships in CLUB, plus anything you add,
   minus anything you hide. Shipped entries are hidden rather
   than deleted, so a reset always brings them back.
   ============================================================ */
(function (w) {
  'use strict';
  var K = 'ncfc.lists.v1';

  /* key -> where the shipped values live, and how it is used */
  var REGISTRY = [
    { key: 'cycleObjectives', label: 'Cycle objective', from: 'cycleObjectives', where: 'Learning design' },
    { key: 'scenarios', label: 'In-game scenario', from: 'scenarios', where: 'Learning design' },
    { key: 'cues', label: 'Player-facing cue', from: null, where: 'Learning design', seed: 'principleCues' },
    { key: 'strategies', label: 'Strategy', from: 'strategies', where: 'Learning design' },
    { key: 'learningPlans', label: 'Learning plan', from: 'learningPlans', where: 'Learning design' },
    { key: 'constraints', label: 'Activity constraints', from: 'constraints', where: 'Activity' },
    { key: 'instances', label: 'Instances to look for', from: null, where: 'Learning design', seed: 'coachingPoints' },
    { key: 'thirds', label: 'Area of the field', from: 'thirds', where: 'Activity' },
    { key: 'channels', label: 'Channel', from: 'channels', where: 'Activity' },
    { key: 'numbers', label: 'Number of players', from: 'numbers', where: 'Activity' },
    { key: 'activityTypes', label: 'Activity type', from: 'activityTypes', where: 'Activity' },
    { key: 'trainingLoad', label: 'Training load', from: 'trainingLoad', where: 'Session and activity' },
    { key: 'methods', label: 'Session method', from: 'methods', where: 'Session' },
    { key: 'fields', label: 'Location', from: 'fields', where: 'Session' },
    { key: 'when', label: 'Coaching interactions (when)', from: 'when', where: 'Activity' },
    { key: 'how', label: 'Coaching interactions (how)', from: 'how', where: 'Activity' },
    { key: 'other', label: 'Coaching interactions (other)', from: 'other', where: 'Activity' },
    { key: 'cancelReasons', label: 'Cancellation reason', from: 'cancelReasons', where: 'Periodization' },
    { key: 'attendance', label: 'Attendance', from: 'attendance', where: 'Readiness' },
    { key: 'designTicks', label: 'Teaching plan tickboxes', from: 'designTicks', where: 'Coach observation' },
    { key: 'phases', label: 'Phases', from: 'phases', where: 'Learning design' },
    { key: 'influences', label: 'What influences the model', from: 'influences', where: 'Game model' },
    { key: 'themes', label: 'Activity themes', from: 'themes', where: 'Activity library' }
  ];

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) {
    try { localStorage.setItem(K, JSON.stringify(d)); return true; }
    catch (e) { if (w.Store) w.Store.toast('Could not save the list.'); return false; }
  }

  function flatten(obj) {
    var out = [];
    Object.keys(obj || {}).forEach(function (g) { (obj[g] || []).forEach(function (x) { out.push(x); }); });
    return out;
  }

  /* ---------- grouped lists ----------
     Player actions and sub-principles are grouped, so an addition has to say
     which group it joins. Same storage, same durability: once added it is in
     every future session, not just the one you were writing. */
  function styleShipped(key) {
    if (key === 'influences') return ((w.STYLE || {}).influences || []).slice();
    return null;
  }
  function groupsShipped(key) {
    var C = w.CLUB || {};
    if (key === 'playerActions') return JSON.parse(JSON.stringify(C.playerActions || {}));
    if (key === 'coachingPoints') return JSON.parse(JSON.stringify(C.coachingPoints || {}));
    if (key === 'intentions') return JSON.parse(JSON.stringify(C.intentions || {}));
    if (key === 'objectives') return JSON.parse(JSON.stringify(C.objectives || {}));
    return {};
  }
  function getGroups(key) {
    if (key === BEHAVIOR_GROUPED) return behaviorGroups();
    var base = groupsShipped(key);
    var d = read()[key] || {};
    var hide = d.hide || [];
    Object.keys(base).forEach(function (g) {
      base[g] = base[g].filter(function (x) { return hide.indexOf(x) < 0; });
    });
    (d.addGrouped || []).forEach(function (row) {
      base[row.group] = base[row.group] || [];
      if (base[row.group].indexOf(row.value) < 0) base[row.group].push(row.value);
    });
    Object.keys(base).forEach(function (g) { if (!base[g].length) delete base[g]; });
    return base;
  }
  function addToGroup(key, group, value) {
    value = (value || '').trim();
    if (!value || !group) return false;
    var d = read();
    d[key] = d[key] || {};
    d[key].hide = (d[key].hide || []).filter(function (x) { return x !== value; });
    if (isBehaviorKey(key)) unhideBehavior(d, value);
    d[key].addGrouped = d[key].addGrouped || [];
    if (!d[key].addGrouped.some(function (r) { return r.group === group && r.value === value; })) {
      d[key].addGrouped.push({ group: group, value: value, added: new Date().toISOString().slice(0, 10) });
    }
    return write(d);
  }
  function groupNames(key) { return Object.keys(groupsShipped(key)); }
  function isMine(key, value) {
    var d = read()[key] || {};
    return (d.add || []).indexOf(value) >= 0 ||
      (d.addGrouped || []).some(function (r) { return r.value === value; });
  }

  /* ---------- desired behaviors ----------
     The same vocabulary is edited in two shapes: 'playerActions' is the grouped
     view the planner draws, 'desiredBehaviors' is the flat view the list editor
     and the periodization dropdowns read. They were separate stores, so an entry
     added on one page never reached the other. Both shapes resolve through the
     merge below instead, so an addition or a hide made anywhere shows up
     everywhere the vocabulary is used. */
  var BEHAVIOR_GROUPED = 'playerActions';
  var BEHAVIOR_FLAT = 'desiredBehaviors';
  var BEHAVIOR_GROUP = 'Added by you';

  function isBehaviorKey(key) { return key === BEHAVIOR_GROUPED || key === BEHAVIOR_FLAT; }
  function behaviorGroups() {
    var d = read();
    var g = d[BEHAVIOR_GROUPED] || {}, f = d[BEHAVIOR_FLAT] || {};
    var hide = (g.hide || []).concat(f.hide || []);
    var base = groupsShipped(BEHAVIOR_GROUPED);
    Object.keys(base).forEach(function (name) {
      base[name] = base[name].filter(function (x) { return hide.indexOf(x) < 0; });
    });
    function anywhere(x) {
      return Object.keys(base).some(function (name) { return base[name].indexOf(x) >= 0; });
    }
    (g.addGrouped || []).forEach(function (row) {
      base[row.group] = base[row.group] || [];
      if (base[row.group].indexOf(row.value) < 0) base[row.group].push(row.value);
    });
    /* a flat addition has no group of its own, so it joins one of its own name
       rather than being dropped for want of somewhere to sit */
    (f.add || []).forEach(function (x) {
      if (anywhere(x)) return;
      base[BEHAVIOR_GROUP] = base[BEHAVIOR_GROUP] || [];
      base[BEHAVIOR_GROUP].push(x);
    });
    Object.keys(base).forEach(function (name) { if (!base[name].length) delete base[name]; });
    return base;
  }
  function unhideBehavior(d, value) {
    [BEHAVIOR_GROUPED, BEHAVIOR_FLAT].forEach(function (k) {
      if (!d[k]) return;
      d[k].hide = (d[k].hide || []).filter(function (x) { return x !== value; });
    });
  }
  /* Removing has to reach both shapes too: drop it wherever it was added, and
     hide it as well if it is one of the shipped entries. */
  function removeBehavior(value) {
    var d = read();
    d[BEHAVIOR_FLAT] = d[BEHAVIOR_FLAT] || { add: [], hide: [] };
    d[BEHAVIOR_FLAT].add = (d[BEHAVIOR_FLAT].add || []).filter(function (x) { return x !== value; });
    d[BEHAVIOR_GROUPED] = d[BEHAVIOR_GROUPED] || {};
    d[BEHAVIOR_GROUPED].addGrouped = (d[BEHAVIOR_GROUPED].addGrouped || [])
      .filter(function (r) { return r.value !== value; });
    if (flatten(groupsShipped(BEHAVIOR_GROUPED)).indexOf(value) >= 0) {
      d[BEHAVIOR_FLAT].hide = d[BEHAVIOR_FLAT].hide || [];
      if (d[BEHAVIOR_FLAT].hide.indexOf(value) < 0) d[BEHAVIOR_FLAT].hide.push(value);
    }
    return write(d);
  }

  /* ---------- sub-principles ----------
     Kept against the principle they belong to, so they show up wherever that
     principle is chosen, for good. */
  function subsFor(code) {
    var p = (w.PRINCIPLES || []).filter(function (x) { return x.code === code; })[0];
    var base = p ? p.subs.slice() : [];
    var d = read()['subs:' + code] || {};
    var hide = d.hide || [];
    base = base.filter(function (s2) { return hide.indexOf(s2.code) < 0; });
    (d.add || []).forEach(function (row) {
      if (!base.some(function (s2) { return s2.code === row.code; })) base.push(row);
    });
    return base;
  }
  /* A new sub-principle continues the numbering: if IP1 runs to IP1.5 the
     next is IP1.6, not a separate series. */
  function nextSubCode(code) {
    var existing = subsFor(code).map(function (s2) { return s2.code; });
    var max = 0;
    existing.forEach(function (c) {
      var m = new RegExp('^' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(\\d+)').exec(c);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    var n = max + 1;
    while (existing.indexOf(code + '.' + n) >= 0) n++;
    return code + '.' + n;
  }
  function addSub(code, text) {
    text = (text || '').trim();
    if (!text) return null;
    var d = read(), k = 'subs:' + code;
    d[k] = d[k] || { add: [], hide: [] };
    var rec = { code: nextSubCode(code), text: text, mine: true };
    d[k].add.push(rec);
    return write(d) ? rec : null;
  }
  function removeSub(code, subCode) {
    var d = read(), k = 'subs:' + code;
    d[k] = d[k] || { add: [], hide: [] };
    d[k].add = (d[k].add || []).filter(function (r) { return r.code !== subCode; });
    d[k].hide = d[k].hide || [];
    if (d[k].hide.indexOf(subCode) < 0) d[k].hide.push(subCode);
    return write(d);
  }

  function shipped(key) {
    var st = styleShipped(key);
    if (st) return st;
    var C = w.CLUB || {};
    var spec = REGISTRY.filter(function (r) { return r.key === key; })[0];
    if (!spec) return C[key] || [];
    if (spec.seed === 'principleCues') {
      var seen = {}, out = [];
      (w.PRINCIPLES || []).forEach(function (p) {
        if (p.cue && !seen[p.cue]) { seen[p.cue] = 1; out.push(p.cue); }
      });
      return out;
    }
    if (spec.seed === 'coachingPoints') return flatten(C.coachingPoints);
    if (spec.seed === 'playerActions') return flatten(C.playerActions);
    return C[spec.from] || [];
  }

  function get(key) {
    if (key === BEHAVIOR_FLAT) return flatten(behaviorGroups());
    var d = read()[key] || {};
    var hide = d.hide || [];
    var base = shipped(key).filter(function (x) { return hide.indexOf(x) < 0; });
    (d.add || []).forEach(function (x) { if (base.indexOf(x) < 0) base.push(x); });
    return base;
  }

  function add(key, value) {
    value = (value || '').trim();
    if (!value) return false;
    var d = read();
    d[key] = d[key] || { add: [], hide: [] };
    d[key].hide = (d[key].hide || []).filter(function (x) { return x !== value; });
    if (isBehaviorKey(key)) unhideBehavior(d, value);
    d[key].add = d[key].add || [];
    if (d[key].add.indexOf(value) < 0 && shipped(key).indexOf(value) < 0) d[key].add.push(value);
    return write(d);
  }

  function remove(key, value) {
    if (isBehaviorKey(key)) return removeBehavior(value);
    var d = read();
    d[key] = d[key] || { add: [], hide: [] };
    d[key].add = (d[key].add || []).filter(function (x) { return x !== value; });
    if (shipped(key).indexOf(value) >= 0) {
      d[key].hide = d[key].hide || [];
      if (d[key].hide.indexOf(value) < 0) d[key].hide.push(value);
    }
    return write(d);
  }

  function reset(key) {
    var d = read();
    if (isBehaviorKey(key)) { delete d[BEHAVIOR_GROUPED]; delete d[BEHAVIOR_FLAT]; }
    else if (key) delete d[key];
    else d = {};
    return write(d);
  }
  /* counted against the resolved list rather than the raw store, so an entry
     added through another view of the same list is still counted as added */
  function counts(key) {
    var live = get(key), all = shipped(key);
    return {
      shipped: all.length,
      added: live.filter(function (x) { return all.indexOf(x) < 0; }).length,
      hidden: all.filter(function (x) { return live.indexOf(x) < 0; }).length,
      total: live.length
    };
  }

  /* ---------- multi-pick ----------
     A dropdown adds one thing at a time, which is slow when you want four.
     This opens a checklist, takes as many as you like, and appends them in one go. */
  function multiPick(opts) {
    var S = w.Store, el = S.el;
    var chosen = {};
    var back = el('div', { class: 'modal', onclick: function (e) { if (e.target === back) back.remove(); } });
    var card = el('div', { class: 'card', style: 'max-width:620px;width:100%;max-height:86vh;display:flex;flex-direction:column' });
    card.appendChild(el('div', { class: 'card-hd' }, [
      el('h2', { text: opts.title }),
      el('p', { class: 'hint', style: 'margin-left:auto', id: 'mpCount', text: 'none selected' })
    ]));
    var bd = el('div', { class: 'card-bd', style: 'overflow:auto;flex:1' });

    var search = el('input', { type: 'text', placeholder: 'Filter' });
    bd.appendChild(el('label', { class: 'f', style: 'margin-bottom:10px' }, [search]));

    var box = el('div');
    bd.appendChild(box);

    function count() {
      var n = Object.keys(chosen).filter(function (k) { return chosen[k]; }).length;
      card.querySelector('#mpCount').textContent = n ? n + ' selected' : 'none selected';
    }
    function draw(filter) {
      box.innerHTML = '';
      var groups = opts.groups || { '': opts.items || [] };
      Object.keys(groups).forEach(function (g) {
        var items = (groups[g] || []).filter(function (x) {
          return !filter || x.toLowerCase().indexOf(filter.toLowerCase()) >= 0;
        });
        if (!items.length) return;
        if (g) box.appendChild(el('p', { class: 'eyebrow', style: 'margin:12px 0 4px', text: g }));
        var list = el('div', { class: 'subs', style: 'max-height:none' });
        items.forEach(function (x) {
          var cb = el('input', { type: 'checkbox' });
          cb.checked = !!chosen[x];
          cb.addEventListener('change', function () { chosen[x] = cb.checked; count(); });
          list.appendChild(el('label', {}, [cb, el('span', { text: x })]));
        });
        box.appendChild(list);
      });
      if (!box.children.length) box.appendChild(el('p', { class: 'hint', text: 'Nothing matches.' }));
    }
    var t;
    search.addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(function () { draw(search.value); }, 150);
    });
    draw('');

    var add = el('input', { type: 'text', placeholder: 'Or write your own and add it to the list' });
    bd.appendChild(el('label', { class: 'f', style: 'margin-top:14px' }, [
      el('span', { text: 'Not there?' }), add]));
    bd.appendChild(el('div', { class: 'btnrow', style: 'margin-top:8px' }, [
      el('button', { class: 'btn ghost sm', text: 'Add to the list', onclick: function () {
        var v = add.value.trim();
        if (!v) return;
        if (opts.groupKey) {
          var names = w.Lists.groupNames(opts.groupKey);
          var g = opts.defaultGroup;
          if (!g) {
            g = prompt('Which group does it belong to?\n\n' + names.join('\n'), names[0]);
            if (!g) return;
          }
          w.Lists.addToGroup(opts.groupKey, g, v);
          opts.groups = w.Lists.getGroups(opts.groupKey);
        } else if (opts.listKey) {
          w.Lists.add(opts.listKey, v);
          opts.groups = null;
          opts.items = w.Lists.get(opts.listKey);
        } else {
          (opts.items = opts.items || []).push(v);
        }
        chosen[v] = true;
        add.value = ''; draw(search.value); count();
      } })
    ]));

    card.appendChild(bd);
    card.appendChild(el('div', { class: 'card-bd', style: 'border-top:1px solid var(--chalk-3)' }, [
      el('div', { class: 'btnrow' }, [
        el('button', { class: 'btn turf', text: 'Add selected', onclick: function () {
          var picked = Object.keys(chosen).filter(function (k) { return chosen[k]; });
          back.remove();
          if (picked.length && opts.onPick) opts.onPick(picked);
        } }),
        el('button', { class: 'btn ghost', text: 'Cancel', onclick: function () { back.remove(); } })
      ])
    ]));
    back.appendChild(card);
    document.body.appendChild(back);
    search.focus();
  }

  /* A small cross on a checkbox row. Works on shipped entries as well as
     your own: shipped ones are hidden and come back with Reset, yours are
     deleted. Nothing is addable that is not also removable. */
  function removeBtn(key, value, after) {
    var S = w.Store, el = S.el;
    var own = shipped(key).indexOf(value) < 0;
    return el('button', {
      class: 'rmx no-print', type: 'button',
      title: own ? 'Delete this, it is yours' : 'Hide this from the list',
      text: '\u2715',
      onclick: function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!confirm((own ? 'Delete' : 'Hide') + ' "' + value + '"?\n\nIt goes from every form that uses this list.')) return;
        remove(key, value);
        if (after) after();
      }
    });
  }
  function removeGroupBtn(key, value, after) {
    var S = w.Store, el = S.el;
    return el('button', {
      class: 'rmx no-print', type: 'button', title: 'Remove from this list', text: '\u2715',
      onclick: function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!confirm('Remove "' + value + '"?\n\nIt goes from every form that uses this list.')) return;
        if (isBehaviorKey(key)) { removeBehavior(value); if (after) after(); return; }
        var d = read();
        d[key] = d[key] || {};
        d[key].addGrouped = (d[key].addGrouped || []).filter(function (r) { return r.value !== value; });
        d[key].hide = d[key].hide || [];
        if (d[key].hide.indexOf(value) < 0) d[key].hide.push(value);
        write(d);
        if (after) after();
      }
    });
  }

  /* ---------- model files ----------
     A game model is principles, sub-principles, role profiles and the vocabulary
     that goes with them. Bundled into one file it can be handed to another coach
     without handing over any sessions, players or fixtures. */
  function exportModel(opts) {
    opts = opts || {};
    var out = {
      kind: 'sessionboard.model', version: 1, exported: new Date().toISOString(),
      name: opts.name || 'Game model',
      principles: (w.PRINCIPLES || []).map(function (p) {
        var c = JSON.parse(JSON.stringify(p));
        c.subs = w.Lists.subsFor(p.code);
        return c;
      }),
      profiles: opts.profiles !== false ? modelProfiles() : [],
      lists: {}
    };
    ['playerActions', 'intentions', 'objectives', 'coachingPoints'].forEach(function (k) {
      out.lists[k] = getGroups(k);
    });
    ['cues', 'phases', 'strategies', 'learningPlans', 'cycleObjectives', 'scenarios',
     'constraints', 'designTicks'].forEach(function (k) {
      out.lists[k] = get(k);
    });
    return out;
  }
  function modelProfiles() {
    try {
      var mine = JSON.parse(localStorage.getItem('ncfc.profiles.v1') || 'null');
      return mine || (w.PROFILES || []);
    } catch (e) { return w.PROFILES || []; }
  }
  function importModel(j) {
    if (!j || j.kind !== 'sessionboard.model') return { ok: false, msg: 'That is not a model file.' };
    var n = 0;
    if (Array.isArray(j.principles) && j.principles.length) {
      w.PRINCIPLES = j.principles;
      if (w.Model) w.Model.write(j.principles);
      n += j.principles.length;
    }
    if (Array.isArray(j.profiles) && j.profiles.length) {
      try { localStorage.setItem('ncfc.profiles.v1', JSON.stringify(j.profiles)); } catch (e) {}
    }
    var d = read();
    Object.keys(j.lists || {}).forEach(function (k) {
      var v = j.lists[k];
      d[k] = d[k] || {};
      if (Array.isArray(v)) {
        d[k].add = v.filter(function (x) { return shipped(k).indexOf(x) < 0; });
      } else {
        d[k].addGrouped = [];
        Object.keys(v || {}).forEach(function (g) {
          (v[g] || []).forEach(function (x) { d[k].addGrouped.push({ group: g, value: x }); });
        });
      }
    });
    write(d);
    return { ok: true, msg: n + ' principles and their vocabulary imported.' };
  }

  /* ---------- structured lists ----------
     Some vocabulary is not a flat list: a feedback scale has a question and
     worded options, an action has outcomes and which of them count as success.
     They are edited as objects rather than being locked in the file. */
  var OBJ = {
    youthScales: {
      label: 'Session feedback scales', from: 'youthScales',
      fields: [['label', 'Name'], ['q', 'The question, as you would ask it'], ['ideal', 'Aim for', 'number']],
      listField: ['options', 'Answers', ['t', 'v']]
    },
    actions: {
      label: 'Match analysis actions', from: 'actions',
      fields: [['type', 'Action'], ['tool', 'Drawn with']],
      listField: ['outcomes', 'Outcomes', null], successField: 'success'
    },
    gameSizes: {
      label: 'Game sizes', from: 'gameSizes',
      fields: [['label', 'Size'], ['objective', 'What it is for'], ['intensity', 'Intensity'],
        ['duration', 'Duration'], ['recovery', 'Recovery'], ['physio', 'Physiological stress'],
        ['mech', 'Mechanical stress'], ['actions', 'Action density'],
        ['time', 'Interval it wants (min)', 'number'], ['rest', 'Rest it wants (min)', 'number']]
    }
  };
  function objSpec(key) { return OBJ[key] || null; }
  function objGet(key) {
    var d = read();
    if (d['obj:' + key]) return JSON.parse(JSON.stringify(d['obj:' + key]));
    var C = w.CLUB || {};
    return JSON.parse(JSON.stringify(C[OBJ[key] ? OBJ[key].from : key] || []));
  }
  function objSet(key, list) {
    var d = read();
    d['obj:' + key] = list;
    return write(d);
  }
  function objReset(key) {
    var d = read();
    delete d['obj:' + key];
    write(d);
  }
  function objEdited(key) { return !!read()['obj:' + key]; }

  /* anything reading CLUB gets the edited version instead */
  (function () {
    var C = w.CLUB;
    if (!C) return;
    Object.keys(OBJ).forEach(function (k) {
      var e = read()['obj:' + k];
      if (e) C[OBJ[k].from] = e;
    });
  })();

  w.Lists = { get: get, add: add, remove: remove, reset: reset, counts: counts, shipped: shipped,
    objSpec: objSpec, objGet: objGet, objSet: objSet, objReset: objReset, objEdited: objEdited,
    OBJ: OBJ,
    exportModel: exportModel, importModel: importModel,
    removeBtn: removeBtn, removeGroupBtn: removeGroupBtn,
    multiPick: multiPick, registry: REGISTRY, KEY: K,
    getGroups: getGroups, addToGroup: addToGroup, groupNames: groupNames, isMine: isMine,
    subsFor: subsFor, addSub: addSub, removeSub: removeSub, nextSubCode: nextSubCode };
})(window);

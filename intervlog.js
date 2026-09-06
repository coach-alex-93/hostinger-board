/* ============================================================
   intervlog.js — timed coaching intervention log
   Who, when, where, and how long. Reused by the gallery sheet
   and the session review, so an intervention logged watching
   someone else records the same way as one of your own.
   ============================================================ */
(function (w) {
  'use strict';
  var S;

  function txt(v) { return (Array.isArray(v) ? v.join(' ') : (v || '')); }

  /* An intervention stops play unless it happened while the ball was rolling.
     Defaulting the other way meant the total read zero until every row was
     tagged, which is exactly when you are least able to tag them. */
  function stopsPlay(e) {
    var when = txt(e.when), how = txt(e.how);
    if (/during active play/i.test(when)) return false;
    if (/drive-by/i.test(how) && !when) return false;
    return true;
  }

  function mmss(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  /* Durations are entered and shown as m:ss. A bare number is read as seconds,
     because most interventions are under a minute. */
  function parseDur(v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return '';
    if (/^\d+:\d{1,2}$/.test(v)) {
      var b = v.split(':');
      return (+b[0]) * 60 + (+b[1]);
    }
    var n = parseFloat(v);
    return isFinite(n) ? Math.round(n) : '';
  }
  function fmtDur(sec) {
    if (sec === '' || sec == null || !isFinite(sec)) return '';
    return mmss(sec);
  }

  function parseTime(v) {
    v = (v || '').trim();
    if (/^\d+:\d{1,2}$/.test(v)) {
      var b = v.split(':');
      return (+b[0]) * 60 + (+b[1]);
    }
    var n = parseFloat(v);
    return isFinite(n) ? Math.round(n * 60) : 0;
  }

  /* mini pitch, click to place, same coordinate space as the board */
  function pitch(entries, active, onPlace) {
    var W = 200, H = 128;
    var box = document.createElement('div');
    box.className = 'minipitch';
    box.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="auto">' +
      '<rect width="' + W + '" height="' + H + '" fill="#14563E"/>' +
      '<rect x="3" y="3" width="' + (W - 6) + '" height="' + (H - 6) + '" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>' +
      '<line x1="' + (W / 2) + '" y1="3" x2="' + (W / 2) + '" y2="' + (H - 3) + '" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>' +
      '<circle cx="' + (W / 2) + '" cy="' + (H / 2) + '" r="16" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>' +
      '<rect x="3" y="' + (H / 2 - 26) + '" width="26" height="52" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>' +
      '<rect x="' + (W - 29) + '" y="' + (H / 2 - 26) + '" width="26" height="52" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5"/>' +
      '<line x1="' + (W / 3) + '" y1="3" x2="' + (W / 3) + '" y2="' + (H - 3) + '" stroke="rgba(255,255,255,.22)" stroke-dasharray="3 3"/>' +
      '<line x1="' + (2 * W / 3) + '" y1="3" x2="' + (2 * W / 3) + '" y2="' + (H - 3) + '" stroke="rgba(255,255,255,.22)" stroke-dasharray="3 3"/>' +
      '<g class="pins"></g></svg>';
    var svg = box.querySelector('svg'), pins = box.querySelector('.pins');

    function redraw() {
      pins.innerHTML = '';
      entries.forEach(function (e, i) {
        if (e.x == null) return;
        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', e.x); c.setAttribute('cy', e.y);
        c.setAttribute('r', e === active ? 6 : 4);
        c.setAttribute('fill', e === active ? '#C87814' : '#F1F3F0');
        c.setAttribute('stroke', '#10202E'); c.setAttribute('stroke-width', '1');
        var t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        t.textContent = mmss(e.t) + ' ' + (e.who || '');
        c.appendChild(t);
        pins.appendChild(c);
      });
    }
    svg.addEventListener('click', function (ev) {
      var r = svg.getBoundingClientRect();
      onPlace(Math.round((ev.clientX - r.left) * (W / r.width)),
        Math.round((ev.clientY - r.top) * (H / r.height)));
    });
    redraw();
    box.redraw = redraw;
    return box;
  }

  /* opts: { roster: [{id,name,number}], onChange: fn } */
  function mount(host, entries, opts) {
    S = w.Store;
    opts = opts || {};
    var el = S.el;
    var C = w.CLUB || {};
    /* Timer state lives on the host element, not in this closure, so remounting
       (switching sheet, linking a session) reattaches to a running clock rather
       than silently resetting it mid-observation. */
    var st = host.__ivclock || (host.__ivclock = {
      t0: null, running: false, elapsed: 0, tick: null,
      openId: null, openStart: null,      // the intervention currently being timed
      ended: false                        // the session is finished, not merely paused
    });

    /* the clock survives a reload because its length is written to the record */
    var meta = opts.meta || {};
    if (!st.running && !st.elapsed && meta.length) { st.elapsed = meta.length; st.ended = !!meta.ended; }
    var active = null;

    /* If the list this mount is given no longer holds the entry being timed
       (a different sheet was opened, or the log was cleared), the timing state
       belongs to nothing and is dropped rather than left dangling. */
    if (st.openId && !entries.some(function (e) { return e.id === st.openId; })) {
      st.openId = null; st.openStart = null;
    }

    /* The clock is built once and never torn down. Only the list below it
       re-renders, so the ticking element stays on the page and one interval
       exists at a time. */
    var clock = el('div', { class: 'ivclock' });
    var read = el('b', { text: '0:00' });
    var readLab = el('span', { class: 'ivlab', text: 'session' });
    var openRead = el('b', { class: 'ivopen', text: '' });
    var startBtn = el('button', { class: 'btn turf', text: 'Start' });
    var resetBtn = el('button', { class: 'btn ghost sm', text: 'Reset to zero' });
    var endBtn = el('button', { class: 'btn ghost sm', text: 'End session' });
    var setBtn = el('button', { class: 'btn ghost sm', text: 'Set clock' });
    var logBtn = el('button', {
      class: 'btn insert', style: 'flex:1;justify-content:center;min-height:52px;font-size:17px',
      text: 'Log an intervention'
    });
    var body = el('div');
    host.innerHTML = '';
    clock.appendChild(el('div', { class: 'ivreadout' }, [read, readLab]));
    clock.appendChild(openRead);
    clock.appendChild(startBtn);
    clock.appendChild(logBtn);
    clock.appendChild(endBtn);
    clock.appendChild(setBtn);
    clock.appendChild(resetBtn);
    host.appendChild(clock);
    host.appendChild(body);

    function change() { if (opts.onChange) opts.onChange(); render(); }
    function now() { return st.elapsed + (st.running && st.t0 ? (Date.now() - st.t0) / 1000 : 0); }

    function openEntry() {
      if (!st.openId) return null;
      for (var i = 0; i < entries.length; i++) if (entries[i].id === st.openId) return entries[i];
      return null;
    }
    function openSecs() {
      return st.openStart ? Math.round((Date.now() - st.openStart) / 1000) : 0;
    }
    function paint() {
      read.textContent = mmss(now());
      if (st.openId) {
        var e = openEntry();
        openRead.textContent = mmss(openSecs());
        openRead.title = 'Intervention started at ' + mmss(e ? e.t : 0);
        openRead.style.display = '';
      } else {
        openRead.textContent = '';
        openRead.style.display = 'none';
      }
    }
    function stopTick() { if (st.tick) { clearInterval(st.tick); st.tick = null; } }
    function startTick() { stopTick(); st.tick = setInterval(paint, 250); }
    function buttons() {
      var timing = !!st.openId, done = !!st.ended;
      startBtn.textContent = st.running ? 'Pause' : (now() > 0 ? 'Resume' : 'Start');
      startBtn.className = 'btn ' + (st.running ? 'ghost' : 'turf');
      startBtn.disabled = timing || done;
      logBtn.textContent = timing ? 'Resume play' : 'Log an intervention';
      logBtn.className = 'btn ' + (timing ? 'turf' : 'insert');
      logBtn.disabled = done;
      endBtn.textContent = done ? 'Reopen session' : 'End session';
      endBtn.className = 'btn ' + (done ? 'ghost sm' : 'warn sm');
      endBtn.disabled = !done && now() === 0;
      setBtn.disabled = timing || done;
      resetBtn.disabled = ((!st.running && now() === 0) || timing) && !done;
      readLab.textContent = done ? 'session ended' : (st.running ? 'session running' : 'session');
      clock.classList.toggle('ended', done);
      paint();
    }

    startBtn.addEventListener('click', function () {
      if (st.running) { st.elapsed = now(); st.running = false; stopTick(); }
      else { st.t0 = Date.now(); st.running = true; startTick(); }
      buttons();
    });

    resetBtn.addEventListener('click', function () {
      if (now() > 0 && !confirm('Reset the clock to zero? Logged interventions stay.')) return;
      stopTick();
      st.running = false; st.elapsed = 0; st.t0 = null;
      st.openId = null; st.openStart = null; st.ended = false;
      meta.length = 0; meta.ended = false;
      if (opts.onChange) opts.onChange();
      buttons();
    });

    /* End is not Pause. It stops the clock, banks the length onto the record,
       and closes the sheet to further logging until you deliberately reopen it. */
    endBtn.addEventListener('click', function () {
      if (st.ended) {
        if (!confirm('Reopen the session and carry on logging?')) return;
        st.ended = false;
        meta.ended = false;
        if (opts.onChange) opts.onChange();
        buttons();
        return;
      }
      if (st.openId) closeIntervention();
      var total = Math.round(now());
      if (!confirm('End the session at ' + mmss(total) + '?\n\nThe length is saved and logging stops until you reopen it.')) return;
      stopTick();
      st.elapsed = total; st.running = false; st.t0 = null; st.ended = true;
      meta.length = total; meta.ended = true;
      change();
      if (S && S.toast) S.toast('Session ended at ' + mmss(total) + '.');
    });

    setBtn.addEventListener('click', function () {
      var v = prompt('Set the clock to (mm:ss). Useful if the session started before you arrived.', mmss(now()));
      if (v === null) return;
      st.elapsed = parseTime(v);
      if (st.running) st.t0 = Date.now();
      meta.length = Math.round(now());
      if (opts.onChange) opts.onChange();
      buttons();
    });

    function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

    /* Tap once when the coach steps in: the entry is stamped with the session
       time and a second clock starts on the intervention itself. Tap again when
       play restarts and the length is written in. */
    function openIntervention() {
      if (st.ended) { if (S && S.toast) S.toast('The session is ended. Reopen it to log more.'); return; }
      if (st.openId) closeIntervention();
      if (!st.running) { st.t0 = Date.now(); st.running = true; startTick(); }
      var e = { id: uid(), t: Math.round(now()), dur: '', who: '', whoId: '',
        when: [], how: [], other: [], note: '', x: null, y: null };
      entries.unshift(e);
      active = e;
      st.openId = e.id; st.openStart = Date.now();
      change();
      if (S && S.toast) S.toast('Stamped at ' + mmss(e.t) + '. Tap again when play restarts.');
    }
    function closeIntervention() {
      var e = openEntry();
      if (e) e.dur = Math.max(1, openSecs());
      st.openId = null; st.openStart = null;
      change();
    }
    logBtn.addEventListener('click', function () {
      if (st.openId) closeIntervention(); else openIntervention();
    });

    /* the clock keeps its own time across a tab going to sleep, because
       everything is measured from Date.now rather than counted ticks */
    w.addEventListener('pagehide', stopTick);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopTick(); else if (st.running) { startTick(); paint(); }
    });

    function render() {
      body.innerHTML = '';
      buttons();

      /* ---- summary ---- */
      body.appendChild(summary(entries, opts));

      if (!entries.length) {
        body.appendChild(el('div', { class: 'empty', style: 'margin-top:12px',
          text: 'Start the clock, then tap Log an intervention each time the coach steps in. Fill the detail in afterwards.' }));
        return;
      }

      /* ---- list ---- */
      var wrap = el('div', { class: 'ivlist' });
      entries.forEach(function (e, i) {
        var card = el('div', { class: 'ivrow' + (e === active ? ' on' : '') });

        if (!e.id) e.id = 'i' + i + '_' + (e.t || 0);
        var tin = el('input', { type: 'text', class: 'num ivtime', value: mmss(e.t) });
        tin.addEventListener('change', function () { e.t = parseTime(tin.value); change(); });

        var dur = el('input', { type: 'text', class: 'num ivtime', placeholder: 'm:ss',
          inputmode: 'numeric' });
        dur.value = fmtDur(e.dur);
        dur.addEventListener('change', function () { e.dur = parseDur(dur.value); change(); });

        var who = el('select');
        who.appendChild(el('option', { value: '', text: 'Who?' }));
        ['Whole team', 'A unit', 'A pair'].forEach(function (x) { who.appendChild(el('option', { value: x, text: x })); });
        if ((opts.roster || []).length) {
          var og = el('optgroup', { label: 'Players' });
          opts.roster.forEach(function (p) {
            og.appendChild(el('option', { value: 'p:' + p.id, text: (p.number ? p.number + ' ' : '') + p.name }));
          });
          who.appendChild(og);
        }
        who.appendChild(el('option', { value: '__other', text: 'Someone else...' }));
        who.value = e.whoId || e.who || '';
        who.addEventListener('change', function () {
          if (who.value === '__other') {
            var v = prompt('Who was it directed at?', e.who || '');
            if (v) { e.who = v; e.whoId = ''; }
          } else if (who.value.indexOf('p:') === 0) {
            e.whoId = who.value;
            var p = (opts.roster || []).filter(function (x) { return 'p:' + x.id === who.value; })[0];
            e.who = p ? p.name : '';
          } else { e.whoId = who.value; e.who = who.value; }
          change();
        });

        /* When and How are multi-select: one intervention can be a planned
           stoppage that demonstrates and asks a question. */
        function arr(v) { return Array.isArray(v) ? v.slice() : (v ? [v] : []); }
        function multi(listKey, val, cb, blank) {
          var chosen = arr(val);
          var wrap = el('div', { class: 'ivmulti' });
          var btn = el('button', {
            class: 'btn ghost sm', type: 'button',
            text: chosen.length ? chosen.length + ' selected' : blank
          });
          btn.addEventListener('click', function () {
            w.Lists.multiPick({
              title: blank, items: w.Lists.get(listKey), listKey: listKey,
              onPick: function (picked) {
                var next = chosen.slice();
                picked.forEach(function (x) { if (next.indexOf(x) < 0) next.push(x); });
                cb(next); change();
              }
            });
          });
          wrap.appendChild(btn);
          if (chosen.length) {
            var tags = el('div', { class: 'ivtags' });
            chosen.forEach(function (x) {
              tags.appendChild(el('button', {
                class: 'ivtag', type: 'button', title: 'Remove', text: x + ' \u00d7',
                onclick: function () { cb(chosen.filter(function (y) { return y !== x; })); change(); }
              }));
            });
            wrap.appendChild(tags);
          }
          return wrap;
        }

        card.appendChild(el('div', { class: 'ivmain' }, [
          el('label', { class: 'f' }, [el('span', { text: 'At' }), tin]),
          el('label', { class: 'f' }, [el('span', { text: 'Lasted' }), dur]),
          el('label', { class: 'f' }, [el('span', { text: 'Who' }), who]),
          el('label', { class: 'f' }, [el('span', { text: 'When' }),
            multi('when', e.when, function (v) { e.when = v; }, 'When?')]),
          el('label', { class: 'f' }, [el('span', { text: 'How' }),
            multi('how', e.how, function (v) { e.how = v; }, 'How?')]),
          el('label', { class: 'f' }, [el('span', { text: 'Other' }),
            multi('other', e.other, function (v) { e.other = v; }, 'Other?')])
        ]));

        var note = el('input', { type: 'text', placeholder: 'What was said or changed' });
        note.value = e.note || '';
        note.addEventListener('input', function () { e.note = note.value; if (opts.onChange) opts.onChange(); });

        var footKids = [note];
        if ((parseFloat(e.dur) || 0)) {
          footKids.push(el('span', {
            class: 'chip ' + (stopsPlay(e) ? 'dt' : 'ao'),
            title: stopsPlay(e) ? 'Counting toward stopped play' : 'Ball was rolling, not counted as stopped',
            text: stopsPlay(e) ? 'stopped ' + fmtDur(e.dur) : 'in play ' + fmtDur(e.dur)
          }));
        }
        if (e.id === st.openId) {
          footKids.push(el('span', { class: 'chip flag', text: 'timing now' }));
        } else {
          footKids.push(el('button', {
            class: 'btn ghost sm', text: 'Time it again',
            onclick: function () {
              st.openId = e.id; st.openStart = Date.now(); active = e; change();
            }
          }));
        }
        card.appendChild(el('div', { class: 'ivfoot' }, footKids.concat([
          el('button', { class: 'btn ghost sm', text: e.x == null ? 'Place on pitch' : 'Move on pitch',
            onclick: function () { active = e; change(); } }),
          el('button', { class: 'btn warn sm', text: 'Delete',
            onclick: function () {
              if (e.id === st.openId) { st.openId = null; st.openStart = null; }
              entries.splice(i, 1); if (active === e) active = null; change();
            } })
        ])));
        wrap.appendChild(card);
      });

      var cols = el('div', { class: 'ivcols' });
      cols.appendChild(wrap);

      var side = el('div');
      side.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px', text: 'Where on the field' }));
      side.appendChild(pitch(entries, active, function (x, y) {
        var target = active || entries[0];
        if (!target) return;
        target.x = x; target.y = y; active = target; change();
      }));
      side.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0', font: null,
        text: active ? 'Click the pitch to place the highlighted intervention.'
          : 'Pick Place on pitch against a row, then click.' }));
      cols.appendChild(side);
      body.appendChild(cols);
    }

    function summary(entries, opts) {
      var el = S.el;
      var box = el('div', { class: 'ivsum' });
      if (!entries.length && !st.ended) return box;
      /* once the session has an end, that is the span; before then the last
         intervention is the best guess available */
      var span = st.ended ? st.elapsed
        : Math.max(Math.round(now()), Math.max.apply(null, entries.map(function (e) { return e.t || 0; }).concat([0])));
      var mins = Math.max(1, span / 60);
      var stopped = entries.reduce(function (a, e) {
        return a + (stopsPlay(e) ? (parseFloat(e.dur) || 0) : 0);
      }, 0);
      var untagged = entries.filter(function (e) {
        return (parseFloat(e.dur) || 0) && !txt(e.when);
      }).length;
      var byWho = {};
      entries.forEach(function (e) { if (e.who) byWho[e.who] = (byWho[e.who] || 0) + 1; });
      var top = Object.keys(byWho).sort(function (a, b) { return byWho[b] - byWho[a]; }).slice(0, 3);

      var rolling = Math.max(0, span - stopped);
      [[mmss(span), st.ended ? 'Session length' : 'Elapsed'],
       [entries.length, 'Interventions'],
       [(entries.length / mins * 10).toFixed(1), 'Per 10 min'],
       [mmss(stopped), 'Play stopped'],
       [mmss(rolling), 'Ball rolling'],
       [Object.keys(byWho).length, 'Different recipients']].forEach(function (x) {
        box.appendChild(el('div', { class: 'stat' }, [
          el('b', { text: String(x[0]) }), el('span', { text: x[1] })]));
      });
      if (top.length) {
        box.appendChild(el('div', { class: 'stat', style: 'grid-column:span 2' }, [
          el('b', { style: 'font-size:15px;line-height:1.3',
            text: top.map(function (k) { return k + ' (' + byWho[k] + ')'; }).join(', ') }),
          el('span', { text: 'Most coached' })]));
      }
      if (untagged) {
        box.appendChild(el('div', { style: 'grid-column:1/-1' }, [
          el('p', { class: 'hint', style: 'margin:0',
            text: untagged + ' timed intervention' + (untagged === 1 ? '' : 's') +
              ' not yet tagged. They count as stopped play until you mark one as During Active Play.' })]));
      }
      return box;
    }

    /* a remount inherits a clock that was already running */
    if (st.running) startTick();
    render();
    return { render: render, stop: stopTick, state: st };
  }

  function asText(v) { return Array.isArray(v) ? v.join(', ') : (v || ''); }
  w.IntervLog = { mount: mount, mmss: mmss, parseTime: parseTime, parseDur: parseDur, fmtDur: fmtDur, asText: asText, stopsPlay: stopsPlay };
})(window);

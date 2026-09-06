/* ============================================================
   clip.js — draw on a video clip
   The file never leaves the device: it is read with an object URL,
   played locally, and nothing is uploaded. What gets saved is the
   frame you froze plus the marks you drew on it, so a board stays
   meaningful after the file has gone.
   ============================================================ */
(function (w) {
  'use strict';

  function mmss(t) {
    t = Math.max(0, t || 0);
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  function mount(host, opts) {
    var S = w.Store, el = S.el;
    var video = null, url = null, name = '';

    function render() {
      host.innerHTML = '';

      var pick = el('input', { type: 'file', accept: 'video/*', style: 'display:none' });
      pick.addEventListener('change', function () {
        var f = pick.files && pick.files[0];
        if (!f) return;
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(f);
        name = f.name;
        video.src = url;
        video.load();
        if (opts.onName) opts.onName(name);
        draw();
      });
      host.appendChild(pick);

      var bar = el('div', { class: 'clipbar' });
      bar.appendChild(el('button', { class: 'btn turf', text: video && video.src ? 'Change clip' : 'Load a clip',
        onclick: function () { pick.click(); } }));
      host.appendChild(bar);

      var wrap = el('div', { class: 'clipwrap' });
      video = el('video', { playsinline: '', preload: 'metadata' });
      video.style.width = '100%';
      wrap.appendChild(video);
      host.appendChild(wrap);

      var time = el('span', { class: 'cliptime', text: '0:00.0' });
      var scrub = el('input', { type: 'range', min: '0', max: '1000', value: '0' });
      scrub.addEventListener('input', function () {
        if (video.duration) video.currentTime = video.duration * (scrub.value / 1000);
      });
      video.addEventListener('loadedmetadata', function () { draw(); });
      video.addEventListener('timeupdate', function () {
        time.textContent = mmss(video.currentTime);
        if (video.duration) scrub.value = String(Math.round(video.currentTime / video.duration * 1000));
      });

      function step(dt) {
        video.pause();
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + dt));
      }

      var controls = el('div', { class: 'clipbar', style: 'margin-top:8px' }, [
        el('button', { class: 'btn ghost sm', text: '\u23ea 1s', onclick: function () { step(-1); } }),
        el('button', { class: 'btn ghost sm', text: '\u25c0 frame', onclick: function () { step(-1 / 25); } }),
        el('button', { class: 'btn ghost sm', text: 'Play / pause',
          onclick: function () { if (video.paused) video.play(); else video.pause(); } }),
        el('button', { class: 'btn ghost sm', text: 'frame \u25b6', onclick: function () { step(1 / 25); } }),
        el('button', { class: 'btn ghost sm', text: '1s \u23e9', onclick: function () { step(1); } }),
        time
      ]);
      host.appendChild(controls);
      host.appendChild(scrub);

      host.appendChild(el('div', { class: 'clipbar', style: 'margin-top:10px' }, [
        el('button', {
          class: 'btn insert', style: 'flex:1;justify-content:center;min-height:46px',
          text: 'Freeze this frame onto the board',
          onclick: function () { freeze(); }
        })
      ]));
      host.appendChild(el('p', { class: 'hint', style: 'margin-top:8px',
        text: 'The clip stays on this device. Nothing is uploaded. What is saved with the board is the frozen frame and the marks you draw on it, so the board still reads after the file has moved.' }));
      draw();
    }

    function freeze() {
      if (!video || !video.videoWidth) { S.toast('Load a clip first.'); return; }
      video.pause();
      var cv = document.createElement('canvas');
      var scale = Math.min(1, 900 / video.videoWidth);
      cv.width = Math.round(video.videoWidth * scale);
      cv.height = Math.round(video.videoHeight * scale);
      cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
      var data;
      try { data = cv.toDataURL('image/jpeg', 0.62); }
      catch (e) { S.toast('That clip will not allow a frame grab.'); return; }
      if (opts.onFreeze) opts.onFreeze(data, video.currentTime, name);
    }

    function draw() { /* placeholder so calls before load are safe */ }
    render();
    return {
      clear: function () { if (url) URL.revokeObjectURL(url); },
      name: function () { return name; }
    };
  }

  w.Clip = { mount: mount, mmss: mmss };
})(window);

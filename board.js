/* ============================================================
   board.js — tactics board
   Object schema is deliberately identical to the IPM1 export so
   old plans import and new plans open in the old tool:
     {type,x,y,x2,y2,color,dir}
   Added, and ignored by the old tool: n (shirt number), t (text).
   Internal coordinate space is 620 x 600, matching IPM1 exports.
   ============================================================ */
(function (w) {
  'use strict';

  var W = 620, H = 600, PAD = 20;

  var HEX = {
    blue: '#2F6FD0', red: '#C8392B', orange: '#E8721E', amber: '#E8B21E', yellow: '#E8B21E',
    white: '#FFFFFF', green: '#2FBF4E', teal: '#1E8264', cyan: '#5BD6E8',
    purple: '#8B3FBF', black: '#10202E', pink: '#D9679A'
  };
  function hex(c) { return HEX[c] || c || '#FFFFFF'; }

  /* Facing is stored two ways on purpose: deg is the real angle, dir is the
     old eight-step index kept in step so diagrams drawn before this still open
     and so anything reading dir keeps working. */
  function angleOf(o) {
    if (o && o.deg != null) return o.deg;
    return ((o && o.dir) || 0) * 45;
  }
  function setAngle(o, deg) {
    deg = ((deg % 360) + 360) % 360;
    o.deg = Math.round(deg);
    o.dir = Math.round(deg / 45) % 8;
    if (o.deg % 45 === 0) delete o.deg;      // a clean eighth needs no extra field
  }

  var TWO_POINT = { line: 1, dash: 1, pass: 1, arrow: 1, dribble: 1, zone: 1, ellipse: 1, curve: 1, curvepass: 1 };
  var PLAYER = { tri: 1, cir: 1, sq: 1 };

  var FIELDS = ['full', 'twothirds', 'half', 'third', 'grid', 'clip'];

  function Board(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = { field: 'full', objects: [], scale: 1 };
    this.tool = 'tri';
    this.color = 'blue';
    this.num = '1';
    this.numbering = false;
    this.dir = null;
    this.deg = null;
    this.sel = -1;
    this.drag = null;
    this.undoStack = [];
    this.redoStack = [];
    this.onchange = null;
    this._fit();
    this._bind();
    this.draw();
    var self = this;
    w.addEventListener('resize', function () { self._fit(); self.draw(); });
  }

  Board.prototype._fit = function () {
    var dpr = Math.min(w.devicePixelRatio || 1, 2);
    this.c.width = W * dpr; this.c.height = H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Board.prototype._pt = function (e) {
    var r = this.c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };

  /* ---------- history ---------- */
  Board.prototype.snap = function () {
    this.undoStack.push(JSON.stringify(this.state.objects));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
  };
  Board.prototype.undo = function () {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.state.objects));
    this.state.objects = JSON.parse(this.undoStack.pop());
    this.sel = -1; this.draw(); this._changed();
  };
  Board.prototype.redo = function () {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.state.objects));
    this.state.objects = JSON.parse(this.redoStack.pop());
    this.sel = -1; this.draw(); this._changed();
  };
  Board.prototype._changed = function () { if (this.onchange) this.onchange(); };

  /* ---------- state ---------- */
  Board.prototype.getState = function () {
    return { field: this.state.field, scale: this.state.scale || 1,
      objects: JSON.parse(JSON.stringify(this.state.objects)) };
  };
  Board.prototype.setState = function (s) {
    s = s || {};
    this.state = {
      field: FIELDS.indexOf(s.field) >= 0 ? s.field : 'full',
      scale: s.scale || 1,
      objects: Array.isArray(s.objects) ? JSON.parse(JSON.stringify(s.objects)) : []
    };
    this.sel = -1; this.undoStack.length = 0; this.redoStack.length = 0;
    this.draw();
  };
  Board.prototype.setField = function (f) {
    this.snap(); this.state.field = f; this.draw(); this._changed();
  };
  /* One size does not fit a full pitch and a 20-yard grid. The board carries
     a scale, and any single piece can differ from it. */
  Board.prototype.setScale = function (v) {
    this.snap(); this.state.scale = v; this.draw(); this._changed();
  };
  /* how far a point can travel out from a centre before it leaves the board */
  function stretchLimit(p, c, lo, hi) {
    if (p > c) return (hi - c) / (p - c);
    if (p < c) return (c - lo) / (c - p);
    return Infinity;
  }
  /* Resizing one piece, not the whole board. A line, arrow or zone has real
     geometry, so bigger means longer or wider: it stretches about its own
     middle and stays where the coach put it. A marker has no geometry to
     stretch, so it carries a size of its own instead. */
  Board.prototype.scaleSel = function (mult) {
    var o = this.state.objects[this.sel];
    if (!o) return;
    if (!TWO_POINT[o.type]) return this.weightSel(mult);
    var mx = (o.x + o.x2) / 2, my = (o.y + o.y2) / 2;
    var m = mult;
    if (m > 1) {
      var pts = [[o.x, o.y], [o.x2, o.y2]];
      if (o.cx != null) pts.push([o.cx, o.cy]);
      pts.forEach(function (q) {
        m = Math.min(m, stretchLimit(q[0], mx, 6, W - 6), stretchLimit(q[1], my, 6, H - 6));
      });
    }
    if (m < 1 && dist(o.x, o.y, o.x2, o.y2) * m < 12) return;
    if (Math.abs(m - 1) < 0.01) return;
    this.snap();
    o.x = mx + (o.x - mx) * m; o.y = my + (o.y - my) * m;
    o.x2 = mx + (o.x2 - mx) * m; o.y2 = my + (o.y2 - my) * m;
    if (o.cx != null) { o.cx = mx + (o.cx - mx) * m; o.cy = my + (o.cy - my) * m; }
    this.draw(); this._changed();
  };
  /* the weight of the piece itself: marker size, or how heavy a line draws */
  Board.prototype.weightSel = function (mult) {
    var o = this.state.objects[this.sel];
    if (!o) return;
    this.snap();
    o.s = Math.max(0.4, Math.min(3, (o.s || 1) * mult));
    if (Math.abs(o.s - 1) < 0.03) delete o.s;
    this.draw(); this._changed();
  };
  Board.prototype.resetSelSize = function () {
    var o = this.state.objects[this.sel];
    if (!o || o.s == null) return;
    this.snap(); delete o.s; this.draw(); this._changed();
  };
  Board.prototype.selSize = function () {
    var o = this.state.objects[this.sel];
    return o && o.s ? o.s : 1;
  };
  /* A copy lands just off the original so both are visible, and takes the
     selection with it, so it can be dragged into place straight away. */
  Board.prototype.duplicateSel = function () {
    var o = this.state.objects[this.sel];
    if (!o) return null;
    var c = JSON.parse(JSON.stringify(o));
    var dx = 22, dy = 22;
    var xs = [c.x], ys = [c.y];
    if (c.x2 != null) { xs.push(c.x2); ys.push(c.y2); }
    if (Math.max.apply(null, xs) + dx > W - 8) dx = -dx;
    if (Math.max.apply(null, ys) + dy > H - 8) dy = -dy;
    c.x += dx; c.y += dy;
    if (c.x2 != null) { c.x2 += dx; c.y2 += dy; }
    if (c.cx != null) { c.cx += dx; c.cy += dy; }
    /* two players in the same shirt is a diagram nobody can read, so a
       numbered copy takes the next number that is free */
    if (PLAYER[c.type] && isFinite(parseInt(c.n, 10))) c.n = String(this._freeNum(parseInt(c.n, 10)));
    /* on the analysis board a line is an action that has been judged. The copy
       is a second line, not a second event, so it starts unclassified rather
       than doubling a total nobody counted twice. */
    delete c.act;
    this.snap();
    this.state.objects.push(c);
    this.sel = this.state.objects.length - 1;
    this.tool = 'select';
    this.draw(); this._changed();
    return c;
  };
  Board.prototype._freeNum = function (from) {
    var used = {};
    this.state.objects.forEach(function (o) { if (o.n != null && o.n !== '') used[String(o.n)] = 1; });
    var n = from + 1;
    while (used[String(n)] && n < from + 100) n++;
    return n;
  };
  /* Recolour what is already drawn, so a line can change side without being
     erased. The renderer takes a palette name or a raw hex either way, so a
     colour picked freely stores exactly the same. Pass commit false while a
     picker is still moving, then true once to land it in the undo stack. */
  Board.prototype.colorSel = function (c, commit) {
    var o = this.state.objects[this.sel];
    if (!o || !c) return;
    if (commit) this.snap();
    o.color = c;
    this.draw();
    if (commit) this._changed();
  };
  Board.prototype.selColor = function () {
    var o = this.state.objects[this.sel];
    return o && o.color ? o.color : '';
  };
  Board.prototype.sizeOf = function (o) { return (this.state.scale || 1) * ((o && o.s) || 1); };
  Board.prototype.clear = function () {
    this.snap(); this.state.objects = []; this.sel = -1; this.draw(); this._changed();
  };
  Board.prototype.deleteSel = function () {
    if (this.sel < 0) return;
    this.snap(); this.state.objects.splice(this.sel, 1); this.sel = -1; this.draw(); this._changed();
  };
  Board.prototype.rotateSel = function (deg) {
    var o = this.state.objects[this.sel];
    if (!o) return;
    this.snap();
    if (TWO_POINT[o.type]) {
      /* swing the line about its own start, so an arrow can be re-aimed
         instead of erased and drawn again */
      var a = deg == null ? 15 : deg;
      var r = a * Math.PI / 180;
      var dx = o.x2 - o.x, dy = o.y2 - o.y;
      o.x2 = o.x + dx * Math.cos(r) - dy * Math.sin(r);
      o.y2 = o.y + dx * Math.sin(r) + dy * Math.cos(r);
    } else if (o.dir != null || o.deg != null) {
      setAngle(o, angleOf(o) + (deg == null ? 45 : deg));
    }
    this.draw(); this._changed();
  };
  Board.prototype.flipSel = function () {
    var o = this.state.objects[this.sel];
    if (!o || !TWO_POINT[o.type]) return;
    this.snap();
    var x = o.x, y = o.y;
    o.x = o.x2; o.y = o.y2; o.x2 = x; o.y2 = y;
    this.draw(); this._changed();
  };
  Board.prototype.hasSel = function () { return this.sel >= 0; };
  Board.prototype.selObj = function () { return this.state.objects[this.sel] || null; };
  Board.prototype.faceSel = function (deg, commit) {
    var o = this.state.objects[this.sel];
    if (!o) return;
    if (commit) this.snap();
    setAngle(o, deg);
    this.draw();
    if (commit) this._changed();
  };
  Board.prototype.selType = function () {
    var o = this.state.objects[this.sel];
    return o ? o.type : '';
  };
  Board.prototype.toPNG = function () {
    var prev = this.sel; this.sel = -1; this.draw();
    var url = this.c.toDataURL('image/png');
    this.sel = prev; this.draw();
    return url;
  };
  Board.prototype.isEmpty = function () { return !this.state.objects.length; };

  /* ---------- hit testing ---------- */
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function segDist(p, o) {
    var dx = o.x2 - o.x, dy = o.y2 - o.y, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p.x - o.x) * dx + (p.y - o.y) * dy) / L)) : 0;
    return dist(p.x, p.y, o.x + t * dx, o.y + t * dy);
  }
  /* inside an area, not just near its edge */
  function inArea(p, o) {
    var x1 = Math.min(o.x, o.x2), x2 = Math.max(o.x, o.x2);
    var y1 = Math.min(o.y, o.y2), y2 = Math.max(o.y, o.y2);
    if (o.type === 'ellipse') {
      var rx = (x2 - x1) / 2 || 1, ry = (y2 - y1) / 2 || 1;
      var nx = (p.x - (x1 + rx)) / rx, ny = (p.y - (y1 + ry)) / ry;
      return nx * nx + ny * ny <= 1;
    }
    return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2;
  }
  Board.prototype.hit = function (p) {
    for (var i = this.state.objects.length - 1; i >= 0; i--) {
      var o = this.state.objects[i];
      if (TWO_POINT[o.type]) {
        if (dist(p.x, p.y, o.x, o.y) < 11) return { i: i, grab: 'a' };
        if (dist(p.x, p.y, o.x2, o.y2) < 11) return { i: i, grab: 'b' };
        if (o.type === 'curve' || o.type === 'curvepass') {
          var hx = o.cx == null ? (o.x + o.x2) / 2 : o.cx;
          var hy = o.cy == null ? (o.y + o.y2) / 2 : o.cy;
          if (dist(p.x, p.y, hx, hy) < 12) return { i: i, grab: 'c' };
        }
        if (segDist(p, o) < 9) return { i: i, grab: 'all' };
      } else {
        var k = this.sizeOf(o);
        var r = (o.type === 'goal' ? 24 : (o.type === 'minigoal' ? 20 : 16)) * k;
        if (dist(p.x, p.y, o.x, o.y) < Math.max(9, r)) return { i: i, grab: 'all' };
      }
    }
    /* Ends, strokes and markers get first refusal above, so a zone stretched
       across the pitch never swallows the players standing in it. Only then
       does the inside of an area count, so a zone can be picked up anywhere
       and recoloured or resized like anything else. */
    for (var j = this.state.objects.length - 1; j >= 0; j--) {
      var z = this.state.objects[j];
      if (z.type !== 'zone' && z.type !== 'ellipse') continue;
      if (inArea(p, z)) return { i: j, grab: 'all' };
    }
    return null;
  };

  /* ---------- input ---------- */
  Board.prototype._bind = function () {
    var self = this, c = this.c;

    c.addEventListener('pointerdown', function (e) {
      c.setPointerCapture(e.pointerId);
      var p = self._pt(e);

      if (self.tool === 'select') {
        var h = self.hit(p);
        self.sel = h ? h.i : -1;
        if (h) { self.snap(); self.drag = { grab: h.grab, ox: p.x, oy: p.y, o: self.state.objects[h.i] }; }
        self.draw();
        self._changed();
        return;
      }

      if (self.tool === 'erase') {
        var h2 = self.hit(p);
        if (h2) { self.snap(); self.state.objects.splice(h2.i, 1); self.draw(); self._changed(); }
        return;
      }

      self.snap();
      if (TWO_POINT[self.tool]) {
        var o = { type: self.tool, color: self.color, x: p.x, y: p.y, x2: p.x, y2: p.y };
        self.state.objects.push(o);
        self.drag = { grab: 'b', o: o, drawing: true };
      } else {
        var n = { type: self.tool, x: p.x, y: p.y };
        if (PLAYER[self.tool]) {
          n.color = self.color;
          if (self.deg != null) setAngle(n, self.deg);
          else n.dir = self.dir == null ? 0 : self.dir;
          if (self.numbering && self.num !== '') {
            n.n = self.num;
            var next = parseInt(self.num, 10);
            if (isFinite(next)) self.num = String(next + 1);
          }
        }
        if (self.tool === 'goal' || self.tool === 'minigoal') {
          if (self.deg != null) setAngle(n, self.deg);
          else n.dir = self.dir == null ? 0 : self.dir;
        }
        if (self.tool === 'cone' || self.tool === 'man') n.color = self.color;
        if (self.tool === 'text') {
          var t = w.prompt('Label text');
          if (!t) { self.undoStack.pop(); return; }
          n.t = t; n.color = self.color;
        }
        self.state.objects.push(n);
        self.sel = self.state.objects.length - 1;
        self.drag = { grab: 'all', ox: p.x, oy: p.y, o: n };
      }
      self.draw(); self._changed();
    });

    c.addEventListener('pointermove', function (e) {
      if (!self.drag) return;
      var p = self._pt(e), d = self.drag, o = d.o;
      if (d.grab === 'b') { o.x2 = p.x; o.y2 = p.y; }
      else if (d.grab === 'a') { o.x = p.x; o.y = p.y; }
      else if (d.grab === 'c') { o.cx = p.x; o.cy = p.y; }
      else {
        var dx = p.x - d.ox, dy = p.y - d.oy;
        o.x += dx; o.y += dy;
        if (o.x2 != null) { o.x2 += dx; o.y2 += dy; }
        if (o.cx != null) { o.cx += dx; o.cy += dy; }
        d.ox = p.x; d.oy = p.y;
      }
      self.draw();
    });

    function end() {
      if (!self.drag) return;
      var o = self.drag.o;
      if (self.drag.drawing && dist(o.x, o.y, o.x2, o.y2) < 6) self.state.objects.pop();
      self.drag = null; self.draw(); self._changed();
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    c.addEventListener('dblclick', function (e) {
      var h = self.hit(self._pt(e));
      if (!h) return;
      var o = self.state.objects[h.i];
      if (PLAYER[o.type]) {
        var n = w.prompt('Shirt number (blank to remove)', o.n || '');
        if (n === null) return;
        self.snap(); if (n === '') delete o.n; else o.n = n;
        self.draw(); self._changed();
      } else if (o.type === 'text') {
        var t = w.prompt('Label text', o.t || '');
        if (t === null) return;
        self.snap(); o.t = t; self.draw(); self._changed();
      }
    });

    c.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var h = self.hit(self._pt(e));
      if (h) { self.snap(); self.state.objects.splice(h.i, 1); self.sel = -1; self.draw(); self._changed(); }
    });
  };

  /* ---------- drawing ---------- */
  Board.prototype.draw = function () {
    var g = this.ctx;
    g.clearRect(0, 0, W, H);
    this._pitch(g);
    for (var i = 0; i < this.state.objects.length; i++) this._obj(g, this.state.objects[i], i === this.sel);
  };

  Board.prototype.setFrame = function (dataUrl, cb) {
    var self = this;
    if (!dataUrl) { this.bg = null; this.draw(); if (cb) cb(); return; }
    var im = new Image();
    im.onload = function () { self.bg = im; self.draw(); if (cb) cb(); };
    im.src = dataUrl;
  };

  Board.prototype._pitch = function (g) {
    var f = this.state.field;
    if (f === 'clip') {
      /* a still from the clip, letterboxed so nothing is cropped and the
         marks you draw sit exactly where they did on the frame */
      g.fillStyle = '#0A1726'; g.fillRect(0, 0, W, H);
      if (this.bg && this.bg.width) {
        var r = Math.min(W / this.bg.width, H / this.bg.height);
        var dw = this.bg.width * r, dh = this.bg.height * r;
        g.drawImage(this.bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        g.fillStyle = 'rgba(255,255,255,.45)';
        g.font = '500 15px Barlow, Arial, sans-serif';
        g.textAlign = 'center';
        g.fillText('Load a clip and freeze a frame', W / 2, H / 2);
      }
      return;
    }
    g.fillStyle = '#4B9E74'; g.fillRect(0, 0, W, H);
    // mow bands, low contrast so drawn lines stay dominant
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (var b = 0; b < 8; b++) if (b % 2 === 0) g.fillRect(0, b * (H / 8), W, H / 8);

    /* the board is narrow, so the markings carry a heavier line than scale */
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3.2; g.lineCap = 'butt';
    /* A real pitch is about 68 by 105, so filling a near-square canvas makes it
       look squashed. The markings are drawn to a true ratio and centred; the
       surround is still grass, so nothing you have already placed moves. */
    var lenM = f === 'full' ? 105 : (f === 'twothirds' ? 70 : (f === 'half' ? 52 : 40));
    var ratio = f === 'grid' ? 1 : 68 / lenM;
    var availW = W - PAD * 2, availH = H - PAD * 2;
    var pw = Math.min(availW, availH * ratio), ph = pw / ratio;
    if (ph > availH) { ph = availH; pw = ph * ratio; }
    if (f === 'grid') { pw = availW; ph = availH; }
    var L = (W - pw) / 2, R = L + pw, T = (H - ph) / 2, B = T + ph, cx = W / 2;
    g.strokeRect(L, T, R - L, B - T);
    if (f === 'grid') { this._grid(g, L, T, R, B); return; }

    /* every marking is now a fraction of the drawn pitch rather than a fixed pixel */
    function box(yTop, depth, halfW) { g.strokeRect(cx - halfW, yTop, halfW * 2, depth); }
    var mPerPx = ph / lenM;                            // depth scales with the length shown
    var boxD = 16.5 * mPerPx, gaD = 5.5 * mPerPx, circ = 9.15 * mPerPx;
    var boxW = pw * 40.3 / 68 / 2, gaW = pw * 18.3 / 68 / 2;
    var my = (T + B) / 2;
    if (f === 'full') {
      g.beginPath(); g.moveTo(L, my); g.lineTo(R, my); g.stroke();
      g.beginPath(); g.arc(cx, my, circ, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, my, 3.4, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill();
      box(T, boxD, boxW); box(B - boxD, boxD, boxW);
      box(T, gaD, gaW); box(B - gaD, gaD, gaW);
      this._d(g, cx, T, boxD, true); this._d(g, cx, B, boxD, false);
      this._corners(g, L, T, R, B, [1, 1, 1, 1]);
    } else if (f === 'twothirds') {
      box(T, boxD, boxW); box(T, gaD, gaW);
      this._d(g, cx, T, boxD, true);
      g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke();
      g.beginPath(); g.arc(cx, B, circ, Math.PI, 0); g.stroke();
      this._corners(g, L, T, R, B, [1, 1, 0, 0]);
    } else if (f === 'half') {
      box(T, boxD, boxW); box(T, gaD, gaW);
      this._d(g, cx, T, boxD, true);
      g.beginPath(); g.arc(cx, B, circ, Math.PI, 0); g.stroke();
      this._corners(g, L, T, R, B, [1, 1, 0, 0]);
    } else if (f === 'third') {
      box(T, boxD, boxW); box(T, gaD, gaW);
      this._d(g, cx, T, boxD, true);
      this._corners(g, L, T, R, B, [1, 1, 0, 0]);
    }
  };
  Board.prototype._grid = function (g, L, T, R, B) {
    g.save(); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.setLineDash([5, 6]);
    for (var i = 1; i < 3; i++) {
      g.beginPath(); g.moveTo(L + (R - L) * i / 3, T); g.lineTo(L + (R - L) * i / 3, B); g.stroke();
      g.beginPath(); g.moveTo(L, T + (B - T) * i / 3); g.lineTo(R, T + (B - T) * i / 3); g.stroke();
    }
    g.restore();
  };
  Board.prototype._spot = function (g, x, y) {
    g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill();
  };
  /* penalty spot and the visible cap of the 10-yard arc.
     depth is the 18-yard box depth in pixels, so everything scales from it. */
  Board.prototype._d = function (g, cx, goalY, depth, down) {
    var yd = depth / 18, spot = 12 * yd, r = 10 * yd;
    var sy = down ? goalY + spot : goalY - spot;
    this._spot(g, cx, sy);
    var half = Math.acos((depth - spot) / r);            // ~0.92 rad
    var base = down ? Math.PI / 2 : -Math.PI / 2;
    g.beginPath(); g.arc(cx, sy, r, base - half, base + half); g.stroke();
  };
  Board.prototype._corners = function (g, L, T, R, B, on) {
    var r = 12;
    if (on[0]) { g.beginPath(); g.arc(L, T, r, 0, Math.PI / 2); g.stroke(); }
    if (on[1]) { g.beginPath(); g.arc(R, T, r, Math.PI / 2, Math.PI); g.stroke(); }
    if (on[2]) { g.beginPath(); g.arc(R, B, r, Math.PI, 1.5 * Math.PI); g.stroke(); }
    if (on[3]) { g.beginPath(); g.arc(L, B, r, 1.5 * Math.PI, 2 * Math.PI); g.stroke(); }
  };

  function head(g, x1, y1, x2, y2, col, size) {
    var a = Math.atan2(y2 - y1, x2 - x1), s = size || 11;
    g.save(); g.fillStyle = col; g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - s * Math.cos(a - 0.42), y2 - s * Math.sin(a - 0.42));
    g.lineTo(x2 - s * Math.cos(a + 0.42), y2 - s * Math.sin(a + 0.42));
    g.closePath(); g.fill(); g.restore();
  }

  /* An action with an outcome overrides the pen colour: green for a success,
     red for a failure. Neutral marks keep whatever colour you drew them in. */
  var OUTCOME_OK = '#1E8264', OUTCOME_BAD = '#C8392B';
  Board.prototype._obj = function (g, o, sel) {
    var col = hex(o.color);
    if (o.act && o.act.outcome) col = o.act.ok ? OUTCOME_OK : OUTCOME_BAD;
    var k = this.sizeOf(o);
    g.save();
    g.lineWidth = 3 * Math.max(0.7, k); g.lineCap = 'round'; g.strokeStyle = col; g.fillStyle = col;

    switch (o.type) {
      case 'line':
        g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x2, o.y2); g.stroke(); break;
      case 'dash':
        g.setLineDash([9 * k, 7 * k]); g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x2, o.y2); g.stroke(); break;
      case 'pass':   // solid arrow, the standard mark for a pass
        g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x2, o.y2); g.stroke();
        head(g, o.x, o.y, o.x2, o.y2, col, 11 * k); break;
      case 'arrow':  // dashed arrow, the standard mark for a run off the ball
        g.setLineDash([11 * k, 8 * k]); g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x2, o.y2); g.stroke();
        g.setLineDash([]); head(g, o.x, o.y, o.x2, o.y2, col, 11 * k); break;
      case 'curve':
      case 'curvepass': {
        /* a bend, with a handle you drag to set how much it bends */
        var mx0 = (o.x + o.x2) / 2, my0 = (o.y + o.y2) / 2;
        var cxp = o.cx == null ? mx0 : o.cx, cyp = o.cy == null ? my0 : o.cy;
        g.setLineDash(o.type === 'curve' ? [10 * k, 7 * k] : []);
        g.beginPath(); g.moveTo(o.x, o.y);
        g.quadraticCurveTo(cxp, cyp, o.x2, o.y2);
        g.stroke();
        var ang = Math.atan2(o.y2 - cyp, o.x2 - cxp);
        head(g, o.x2 - Math.cos(ang), o.y2 - Math.sin(ang), o.x2, o.y2, col, 11 * k);
        break;
      }
      case 'dribble': {
        var dx = o.x2 - o.x, dy = o.y2 - o.y, len = Math.hypot(dx, dy) || 1;
        var ux = dx / len, uy = dy / len, px = -uy, py = ux, amp = 5 * k, waves = Math.max(2, Math.round(len / (16 * k)));
        g.beginPath(); g.moveTo(o.x, o.y);
        for (var i = 1; i <= waves * 8; i++) {
          var t = i / (waves * 8), off = Math.sin(t * waves * Math.PI * 2) * amp;
          g.lineTo(o.x + ux * len * t + px * off, o.y + uy * len * t + py * off);
        }
        g.stroke(); head(g, o.x, o.y, o.x2, o.y2, col, 11 * k); break;
      }
      case 'zone': {
        var x = Math.min(o.x, o.x2), y = Math.min(o.y, o.y2);
        g.globalAlpha = 0.2; g.fillRect(x, y, Math.abs(o.x2 - o.x), Math.abs(o.y2 - o.y));
        g.globalAlpha = 1; g.lineWidth = 2 * Math.max(0.7, k); g.setLineDash([7, 5]);
        g.strokeRect(x, y, Math.abs(o.x2 - o.x), Math.abs(o.y2 - o.y)); break;
      }
      case 'ellipse': {
        var mx = (o.x + o.x2) / 2, my = (o.y + o.y2) / 2;
        var rx = Math.abs(o.x2 - o.x) / 2, ry = Math.abs(o.y2 - o.y) / 2;
        g.beginPath();
        if (g.ellipse) g.ellipse(mx, my, rx || 1, ry || 1, 0, 0, Math.PI * 2);
        else g.arc(mx, my, Math.max(rx, ry) || 1, 0, Math.PI * 2);
        g.globalAlpha = 0.2; g.fill();
        g.globalAlpha = 1; g.lineWidth = 2 * Math.max(0.7, k); g.setLineDash([7, 5]); g.stroke(); break;
      }
      case 'tri': {
        var a = angleOf(o) * Math.PI / 180, r = 14 * k;
        g.translate(o.x, o.y); g.rotate(a);
        g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.88, r * 0.72); g.lineTo(-r * 0.88, r * 0.72); g.closePath();
        g.fill(); g.lineWidth = 2 * k; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
        g.restore(); g.save();               // drop the rotation so the number stays upright
        this._num(g, o, o.x, o.y + 3 * k, k); break;
      }
      case 'cir':
        g.beginPath(); g.arc(o.x, o.y, 12 * k, 0, Math.PI * 2); g.fill();
        g.lineWidth = 2 * k; g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
        this._num(g, o, o.x, o.y, k);
        this._name(g, o, o.x, o.y + 13 * k, k); break;
      case 'sq':
        g.fillRect(o.x - 11 * k, o.y - 11 * k, 22 * k, 22 * k);
        g.lineWidth = 2 * k; g.strokeStyle = 'rgba(255,255,255,.95)';
        g.strokeRect(o.x - 11 * k, o.y - 11 * k, 22 * k, 22 * k);
        this._num(g, o, o.x, o.y, k); break;
      case 'ball':
        g.beginPath(); g.arc(o.x, o.y, 9 * k, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
        g.lineWidth = 1.6 * k; g.strokeStyle = '#10202E'; g.stroke();
        g.beginPath(); g.arc(o.x, o.y, 3.2 * k, 0, Math.PI * 2); g.fillStyle = '#10202E'; g.fill(); break;
      case 'cone': {
        /* a flat marker disc: an ellipse lying on the grass with a hole in it,
           so it never reads as a player */
        var rx = 11 * k, ry = 4.4 * k;
        g.fillStyle = o.color ? col : '#E8721E';
        g.beginPath();
        if (g.ellipse) g.ellipse(o.x, o.y, rx, ry, 0, 0, Math.PI * 2);
        else g.arc(o.x, o.y, rx, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 1.2 * k; g.strokeStyle = 'rgba(10,23,38,.5)'; g.stroke();
        g.beginPath();
        if (g.ellipse) g.ellipse(o.x, o.y, rx * 0.3, ry * 0.34, 0, 0, Math.PI * 2);
        else g.arc(o.x, o.y, rx * 0.3, 0, Math.PI * 2);
        g.fillStyle = '#14563E'; g.fill();
        g.lineWidth = 0.9 * k; g.strokeStyle = 'rgba(10,23,38,.45)'; g.stroke();
        break;
      }
      case 'man':
        g.fillStyle = '#D8DEE4'; g.beginPath();
        if (g.roundRect) { g.roundRect(o.x - 7 * k, o.y - 15 * k, 14 * k, 30 * k, 7 * k); }
        else { g.rect(o.x - 7 * k, o.y - 15 * k, 14 * k, 30 * k); }
        g.fill(); g.lineWidth = 2 * k; g.strokeStyle = '#5C7086'; g.stroke(); break;
      case 'goal': this._goal(g, o, 74 * k, k); break;
      case 'minigoal': this._goal(g, o, 36 * k, k); break;
      case 'text':
        g.font = '600 ' + (15 * k) + 'px Barlow, Arial, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 4 * k; g.strokeStyle = 'rgba(10,23,38,.75)';
        g.strokeText(o.t || '', o.x, o.y); g.fillStyle = col; g.fillText(o.t || '', o.x, o.y); break;
    }
    if (o.act && o.act.outcome && TWO_POINT[o.type]) {
      g.save();
      g.beginPath();
      g.arc(o.x2, o.y2, 8, 0, Math.PI * 2);
      g.fillStyle = o.act.ok ? OUTCOME_OK : OUTCOME_BAD;
      g.fill();
      g.lineWidth = 1.6; g.strokeStyle = '#fff'; g.stroke();
      g.font = '700 11px "IBM Plex Mono", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      g.fillText(o.act.ok ? '\u2713' : '\u2717', o.x2, o.y2 + 0.5);
      g.restore();
    }
    g.restore();

    if (sel) {
      g.save();
      g.strokeStyle = '#FFD24A'; g.lineWidth = 1.6; g.setLineDash([4, 3]);
      if (TWO_POINT[o.type]) {
        var pts = [[o.x, o.y], [o.x2, o.y2]];
        if (o.type === 'curve' || o.type === 'curvepass') {
          pts.push([o.cx == null ? (o.x + o.x2) / 2 : o.cx, o.cy == null ? (o.y + o.y2) / 2 : o.cy]);
        }
        pts.forEach(function (p) {
          g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.stroke();
        });
      } else {
        g.beginPath(); g.arc(o.x, o.y, 20 * this.sizeOf(o), 0, Math.PI * 2); g.stroke();
      }
      g.restore();
    }
  };

  Board.prototype._name = function (g, o, x, y, k) {
    if (!o.name) return;
    k = k || 1;
    g.save();
    g.font = '600 ' + (10.5 * k) + 'px Barlow, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.lineWidth = 3 * k; g.strokeStyle = 'rgba(10,23,38,.7)';
    var t = o.name.split(' ').slice(-1)[0];
    g.strokeText(t, x, y); g.fillStyle = '#fff'; g.fillText(t, x, y);
    g.restore();
  };
  Board.prototype._num = function (g, o, x, y, k) {
    if (o.n == null || o.n === '') return;
    g.font = '700 ' + (12 * (k || 1)) + 'px "IBM Plex Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText(String(o.n), x, y);
  };

  Board.prototype._goal = function (g, o, wide, k) {
    k = k || 1;
    var a = angleOf(o) * Math.PI / 180, d = 13 * k;
    g.save(); g.translate(o.x, o.y); g.rotate(a);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 3.5 * k; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-wide / 2, d); g.lineTo(-wide / 2, -d); g.lineTo(wide / 2, -d); g.lineTo(wide / 2, d);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.4 * k;
    for (var i = 1; i < 6; i++) {
      var xx = -wide / 2 + wide * i / 6;
      g.beginPath(); g.moveTo(xx, -d); g.lineTo(xx, d); g.stroke();
    }
    g.restore();
  };

  /* which of the nine zones a point falls in, attacking upward */
  /* Thirds and channels, plus the boxes. A goal from inside the penalty area is
     a different event from one outside it, so the area is named rather than
     collapsed into "attacking third". Geometry matches what _pitch draws. */
  Board.zoneOf = function (x, y, field) {
    var C = w.CLUB && w.CLUB.zones;
    var thirds = (C && C.thirds) || ['Defensive third', 'Middle third', 'Attacking third'];
    var chans = (C && C.channels) || ['Left', 'Central', 'Right'];
    var band = y < H / 3 ? 2 : (y < 2 * H / 3 ? 1 : 0);
    var ch = x < W / 3 ? 0 : (x < 2 * W / 3 ? 1 : 2);

    var area = '', end = '';
    var f = field || 'full';
    var lenM = f === 'full' ? 105 : (f === 'twothirds' ? 70 : (f === 'half' ? 52 : 40));
    if (f !== 'grid') {
      var ratio = 68 / lenM;
      var availW = W - PAD * 2, availH = H - PAD * 2;
      var pw = Math.min(availW, availH * ratio), ph = pw / ratio;
      if (ph > availH) { ph = availH; pw = ph * ratio; }
      var L = (W - pw) / 2, R = L + pw, T = (H - ph) / 2, B = T + ph;
      var mPerPx = ph / lenM;
      var boxD = 16.5 * mPerPx, gaD = 5.5 * mPerPx;
      var boxW = pw * 40.3 / 68 / 2, gaW = pw * 18.3 / 68 / 2;
      var cx = W / 2;
      var inX = function (half) { return Math.abs(x - cx) <= half; };
      if (y >= T && y <= T + gaD && inX(gaW)) { area = 'Goal area'; end = 'attacking'; }
      else if (y >= T && y <= T + boxD && inX(boxW)) { area = 'Penalty area'; end = 'attacking'; }
      else if (f === 'full' && y <= B && y >= B - gaD && inX(gaW)) { area = 'Goal area'; end = 'defensive'; }
      else if (f === 'full' && y <= B && y >= B - boxD && inX(boxW)) { area = 'Penalty area'; end = 'defensive'; }
    }
    var label = area
      ? (end === 'defensive' ? 'Own ' + area.toLowerCase() : area)
      : thirds[band] + ' \u00b7 ' + chans[ch];
    return { third: thirds[band], channel: chans[ch], area: area, end: end, key: label };
  };
  Board.angleOf = angleOf; Board.setAngle = setAngle;
  Board.W = W; Board.H = H; Board.FIELDS = FIELDS; Board.HEX = HEX; Board.hexOf = hex;
  w.Board = Board;

  /* ---------- uploaded pictures and frozen frames ----------
     A picture lives on the state as a data URL, and decoding one is
     asynchronous while every renderer here is synchronous. One cache keyed by
     the URL is shared by the thumbnails, the printed sheet and the library, so
     a picture that has been decoded once draws everywhere without each caller
     keeping its own copy of the image. */
  var FRAMES = {};
  function cachedFrame(url) {
    var im = url ? FRAMES[url] : null;
    return im && im.complete && im.naturalWidth ? im : null;
  }
  w.boardFrame = cachedFrame;
  /* "have we tried this URL yet", which is what a caller that redraws when a
     picture arrives must ask. A picture that failed to decode has been tried,
     so asking again would redraw for ever. */
  w.boardFrameSeen = function (url) { return !!(url && FRAMES[url]); };
  w.preloadBoardFrames = function (states, cb) {
    var urls = [];
    (states || []).forEach(function (st) {
      var u = st && st.frame;
      if (u && !FRAMES[u] && urls.indexOf(u) < 0) urls.push(u);
    });
    var left = urls.length;
    if (!left) { if (cb) cb(); return; }
    urls.forEach(function (u) {
      var im = new Image();
      FRAMES[u] = im;
      im.onload = im.onerror = function () { if (--left === 0 && cb) cb(); };
      im.src = u;
    });
  };

  /* ---------- static renderer, used for print and thumbnails ---------- */
  w.renderBoardPNG = function (state, scale, frameImg) {
    var cv = document.createElement('canvas');
    var s = scale || 1;
    cv.width = W * s; cv.height = H * s;
    var b = Object.create(Board.prototype);
    b.c = cv; b.ctx = cv.getContext('2d'); b.ctx.setTransform(s, 0, 0, s, 0, 0);
    b.state = state && state.objects ? state : { field: 'full', objects: [], scale: 1 };
    if (!b.state.scale) b.state.scale = 1;
    b.bg = (frameImg && frameImg.width ? frameImg : cachedFrame(b.state.frame)) || null;
    b.sel = -1;
    b.draw();
    return cv.toDataURL('image/png');
  };
})(window);

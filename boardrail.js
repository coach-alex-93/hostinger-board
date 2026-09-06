/* boardrail.js — the grouped tool rail, shared by the planner's diagram modal
   and the standalone tactics board. */
(function (w) {
  'use strict';
  var S, el;
  function ready() { S = w.Store; el = S.el; }

  var COLORS = ['blue', 'red', 'orange', 'amber', 'white', 'green', 'cyan', 'purple', 'black'];
  var ARROWS = ['\u2196', '\u2191', '\u2197', '\u2190', '\u00b7', '\u2192', '\u2199', '\u2193', '\u2198'];
  var ARROW_DIR = [7, 0, 1, 6, null, 2, 5, 4, 3];
  var editingAct = null;

  function ico(kind, color) {
    var c = window.Board.HEX[color] || color || '#2F6FD0';
    var S2 = 'width="18" height="18" viewBox="0 0 18 18"';
    if (kind === 'tri') return '<svg ' + S2 + '><polygon points="9,2 16,15 2,15" fill="' + c + '"/></svg>';
    if (kind === 'cir') return '<svg ' + S2 + '><circle cx="9" cy="9" r="7" fill="' + c + '"/></svg>';
    if (kind === 'sq') return '<svg ' + S2 + '><rect x="2" y="2" width="14" height="14" rx="2" fill="' + c + '"/></svg>';
    if (kind === 'ball') return '<svg ' + S2 + '><circle cx="9" cy="9" r="7" fill="#fff" stroke="#10202E" stroke-width="1.6"/><circle cx="9" cy="9" r="2.6" fill="#10202E"/></svg>';
    if (kind === 'cone') return '<svg ' + S2 + '><polygon points="9,3 15,14 3,14" fill="#E8721E"/></svg>';
    if (kind === 'man') return '<svg ' + S2 + '><rect x="6" y="2" width="6" height="14" rx="3" fill="#D8DEE4" stroke="#5C7086" stroke-width="1.4"/></svg>';
    if (kind === 'goal') return '<svg ' + S2 + '><path d="M2 13 V6 H16 V13" fill="none" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'minigoal') return '<svg ' + S2 + '><path d="M5 13 V8 H13 V13" fill="none" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'arrow') return '<svg ' + S2 + '><path d="M3 15 L14 4" stroke="#10202E" stroke-width="1.8" stroke-dasharray="3 2"/><path d="M15 3 L10 4.5 L13.5 8 Z" fill="#10202E"/></svg>';
    if (kind === 'curvepass' || kind === 'curve') return '<svg ' + S2 + '><path d="M3 15 Q4 5 14 4" fill="none" stroke="#10202E" stroke-width="1.8"' + (kind === 'curve' ? ' stroke-dasharray="3 2"' : '') + '/><path d="M15 3 L10 4.5 L13.5 8 Z" fill="#10202E"/></svg>';
    if (kind === 'cone') return '<svg ' + S2 + '><ellipse cx="9" cy="11" rx="7" ry="3" fill="#E8721E"/><ellipse cx="9" cy="11" rx="2" ry="1" fill="#14563E"/></svg>';
    if (kind === 'pass') return '<svg ' + S2 + '><path d="M3 15 L14 4" stroke="#10202E" stroke-width="1.8"/><path d="M15 3 L10 4.5 L13.5 8 Z" fill="#10202E"/></svg>';
    if (kind === 'dribble') return '<svg ' + S2 + '><path d="M4 15 q3-3 0-5 t0-5" fill="none" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'line') return '<svg ' + S2 + '><path d="M3 15 L15 3" stroke="#10202E" stroke-width="1.8"/></svg>';
    if (kind === 'dash') return '<svg ' + S2 + '><path d="M3 15 L15 3" stroke="#10202E" stroke-width="1.8" stroke-dasharray="3 3"/></svg>';
    if (kind === 'zone') return '<svg ' + S2 + '><rect x="3" y="4" width="12" height="10" fill="#9EC4E8" stroke="#3C6FA8" stroke-width="1.4"/></svg>';
    if (kind === 'text') return '<svg ' + S2 + '><text x="9" y="14" text-anchor="middle" font-size="13" font-weight="700" fill="#10202E">T</text></svg>';
    if (kind === 'select') return '<svg ' + S2 + '><path d="M4 2 L14 10 L9 10.5 L11 15 L9 16 L7 11.5 L4 14 Z" fill="#10202E"/></svg>';
    if (kind === 'erase') return '<svg ' + S2 + '><rect x="3" y="8" width="12" height="6" rx="1.5" transform="rotate(-35 9 11)" fill="#C8392B"/></svg>';
    return '';
  }

  /* A ring with a ball on it. Drag the ball and the piece turns with it,
     live, at any angle rather than in eight steps. The middle clears the
     facing for pieces that do not need one. */
  function dial(board, hostId, target) {
    var NS = 'http://www.w3.org/2000/svg';
    var R = 44, C = 60;
    var box = document.createElement('div');
    box.className = 'dialwrap';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'dial');

    function mk(t, a) { var n = document.createElementNS(NS, t); for (var k in a) n.setAttribute(k, a[k]); return n; }
    svg.appendChild(mk('circle', { cx: C, cy: C, r: R, class: 'dial-ring' }));
    for (var i = 0; i < 8; i++) {
      var a0 = i * 45 * Math.PI / 180;
      svg.appendChild(mk('line', {
        x1: C + (R - 6) * Math.sin(a0), y1: C - (R - 6) * Math.cos(a0),
        x2: C + R * Math.sin(a0), y2: C - R * Math.cos(a0), class: 'dial-tick'
      }));
    }
    var stem = mk('line', { x1: C, y1: C, x2: C, y2: C - R, class: 'dial-stem' });
    var knob = mk('circle', { cx: C, cy: C - R, r: 11, class: 'dial-knob' });
    var mid = mk('circle', { cx: C, cy: C, r: 13, class: 'dial-mid' });
    var lbl = mk('text', { x: C, y: C + 4, class: 'dial-label' });
    svg.appendChild(stem); svg.appendChild(mid); svg.appendChild(knob); svg.appendChild(lbl);

    function current() {
      if (target) return window.Board.angleOf(target);
      return board.deg != null ? board.deg : (board.dir == null ? null : board.dir * 45);
    }
    function place() {
      var deg = current();
      var off = deg == null;
      svg.classList.toggle('none', off);
      var a = (deg || 0) * Math.PI / 180;
      knob.setAttribute('cx', C + R * Math.sin(a));
      knob.setAttribute('cy', C - R * Math.cos(a));
      stem.setAttribute('x2', C + R * Math.sin(a));
      stem.setAttribute('y2', C - R * Math.cos(a));
      lbl.textContent = off ? 'none' : Math.round(deg) + '\u00b0';
    }

    function angleAt(e) {
      var r = svg.getBoundingClientRect();
      var x = (e.clientX - r.left) * (120 / r.width) - C;
      var y = (e.clientY - r.top) * (120 / r.height) - C;
      var deg = Math.atan2(x, -y) * 180 / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      var near = Math.round(deg / 45) * 45;         // settle on an eighth when close
      if (Math.abs(((deg - near + 540) % 360) - 180) > 174) deg = near % 360;
      return Math.round(deg);
    }
    function apply(deg, commit) {
      if (target) board.faceSel(deg, commit);
      else { board.deg = deg; board.dir = Math.round(deg / 45) % 8; }
      place();
    }

    var dragging = false;
    svg.addEventListener('pointerdown', function (e) {
      var r = svg.getBoundingClientRect();
      var x = (e.clientX - r.left) * (120 / r.width) - C;
      var y = (e.clientY - r.top) * (120 / r.height) - C;
      if (Math.hypot(x, y) < 15) {                  // the middle clears it
        if (target) { board.snap(); delete target.deg; target.dir = 0; board.draw(); board._changed(); }
        else { board.deg = null; board.dir = null; }
        place();
        return;
      }
      dragging = true;
      svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
      if (target) board.snap();
      apply(angleAt(e), false);
    });
    svg.addEventListener('pointermove', function (e) { if (dragging) apply(angleAt(e), false); });
    function stop() { if (!dragging) return; dragging = false; if (target) board._changed(); }
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);

    place();
    box.appendChild(svg);
    return box;
  }

  function railSection(title, count) {
    var h = el('h4', {}, [el('span', { text: title })]);
    if (count != null) h.appendChild(el('span', { class: 'ct', text: String(count) }));
    var sec = el('section');
    sec.appendChild(h);
    return sec;
  }

  function buildBoardRail(board, hostId) {
    hostId = hostId || 'rail';
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';

    // FIELD
    var f = railSection('Field');
    var seg = el('div', { class: 'seg' });
    [['full', 'Full'], ['twothirds', '\u2154'], ['half', 'Half'], ['third', 'Third'], ['grid', 'Blank'], ['clip', 'Clip']]
      .forEach(function (x) {
        var b = el('button', { type: 'button', text: x[1], 'aria-pressed': board.state.field === x[0] ? 'true' : 'false' });
        b.addEventListener('click', function () { board.setField(x[0]); buildBoardRail(board, hostId); });
        seg.appendChild(b);
      });
    f.appendChild(seg);
    host.appendChild(f);

    // FORMATION
    if (w.Lineup) {
      var fm = railSection('Formation');
      var shapes = [];
      try {
        var gmx = JSON.parse(localStorage.getItem('ncfc.gamemodel.v1') || '{}');
        (gmx.formations || []).forEach(function (f) {
          if (f.shapeIn && shapes.indexOf(f.shapeIn) < 0) shapes.push(f.shapeIn);
          if (f.shapeOut && shapes.indexOf(f.shapeOut) < 0) shapes.push(f.shapeOut);
        });
      } catch (e) {}
      ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-4-3', '4-1-4-1', '2-3-1', '3-2-3']
        .forEach(function (x) { if (shapes.indexOf(x) < 0) shapes.push(x); });
      var fmSel = el('select');
      fmSel.appendChild(el('option', { value: '', text: '- shape -' }));
      shapes.forEach(function (x) { fmSel.appendChild(el('option', { value: x, text: x })); });
      fm.appendChild(fmSel);

      /* whose shape it is decides the colour and which way it faces */
      board.fmSide = board.fmSide || 'us';
      var sideSeg = el('div', { class: 'seg', style: 'margin-top:6px' });
      [['us', 'Us'], ['them', 'Opposition']].forEach(function (x) {
        var b = el('button', { type: 'button', text: x[1],
          'aria-pressed': board.fmSide === x[0] ? 'true' : 'false' });
        b.addEventListener('click', function () { board.fmSide = x[0]; buildBoardRail(board, hostId); });
        sideSeg.appendChild(b);
      });
      fm.appendChild(sideSeg);

      /* Putting a shape out replaces that side, not the whole board. The other
         team and anything you have drawn stay where they are. */
      function place(keep) {
        if (!fmSel.value) { S.toast('Choose a shape first.'); return; }
        var them = board.fmSide === 'them';
        var side = them ? 'them' : 'us';
        var st = w.Lineup.diagram(fmSel.value, null, { flip: them, color: them ? 'red' : 'blue', side: side });
        if (!st) { S.toast('That shape could not be read.'); return; }
        board.snap();
        var cleared = keep ? 0 : w.Lineup.clearSide(board, side);
        board.state.objects = board.state.objects.concat(st.objects);
        board.draw(); board._changed();
        buildBoardRail(board, hostId);
        S.toast(fmSel.value + ' out for ' + (them ? 'the opposition' : 'us') +
          (cleared ? ', replacing the ' + cleared + ' already there' : '') + '.');
      }
      fm.appendChild(el('button', {
        class: 'btn turf sm', style: 'margin-top:6px;width:100%;justify-content:center',
        text: 'Put it out',
        onclick: function () { place(false); }
      }));
      fm.appendChild(el('button', {
        class: 'btn ghost sm', style: 'margin-top:5px;width:100%;justify-content:center',
        text: 'Add without clearing',
        title: 'Leave whatever is already out and add these on top',
        onclick: function () { place(true); }
      }));
      fm.appendChild(el('button', {
        class: 'btn warn sm', style: 'margin-top:5px;width:100%;justify-content:center',
        text: 'Clear the pitch',
        onclick: function () {
          var n = board.state.objects.length;
          if (!n) { S.toast('Nothing on the pitch.'); return; }
          if (!confirm('Clear all ' + n + ' pieces from the pitch?\n\nUndo will bring them back.')) return;
          board.snap();
          board.state.objects = [];
          board.sel = -1;
          board.draw(); board._changed();
          buildBoardRail(board, hostId);
        }
      }));
      fm.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
        text: 'Put it out replaces that side only, so changing our shape leaves the opposition where it is. ' +
          'Us are blue coming up the pitch, the opposition red coming down.' }));
      host.appendChild(fm);
    }

    // SIZE
    var sz = railSection('Piece size');
    var szSeg = el('div', { class: 'seg' });
    [['0.6', 'XS'], ['0.8', 'S'], ['1', 'M'], ['1.25', 'L'], ['1.5', 'XL']].forEach(function (x) {
      var cur = String(board.state.scale || 1);
      var b = el('button', { type: 'button', text: x[1], 'aria-pressed': cur === x[0] ? 'true' : 'false' });
      b.addEventListener('click', function () { board.setScale(parseFloat(x[0])); buildBoardRail(board, hostId); });
      szSeg.appendChild(b);
    });
    sz.appendChild(szSeg);
    sz.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
      text: 'Sets every piece on this board at once. A full pitch usually wants S, a small grid L. ' +
        'To resize one piece on its own, select it and use the size buttons in Edit.' }));
    host.appendChild(sz);

    // PLAYERS
    var pcount = board.state.objects.filter(function (o) {
      return o.type === 'tri' || o.type === 'cir' || o.type === 'sq';
    }).length;
    var pl = railSection('Players', pcount);
    var tiles = el('div', { class: 'tiles' });
    [['tri', 'Triangle'], ['cir', 'Circle'], ['sq', 'Square']].forEach(function (x) {
      var b = el('button', { class: 'tile', type: 'button', 'aria-pressed': board.tool === x[0] ? 'true' : 'false',
        html: ico(x[0], board.color) + '<span>' + x[1] + '</span>' });
      b.addEventListener('click', function () { board.tool = x[0]; buildBoardRail(board, hostId); });
      tiles.appendChild(b);
    });
    pl.appendChild(tiles);
    host.appendChild(pl);

    // TEAM COLOR
    var tc = railSection('Team color');
    var dots = el('div', { class: 'dots' });
    COLORS.forEach(function (c) {
      var b = el('button', { class: 'dot', type: 'button', title: c,
        style: 'background:' + window.Board.HEX[c], 'aria-pressed': board.color === c ? 'true' : 'false' });
      b.addEventListener('click', function () { board.color = c; buildBoardRail(board, hostId); });
      dots.appendChild(b);
    });
    tc.appendChild(dots);
    tc.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
      text: 'Sets the color of the next piece you put down. To change something already ' +
        'drawn, select it and use the colors in Edit.' }));
    host.appendChild(tc);

    // ORIENTATION - a dial, live, on the selected piece or on the next one
    var selObj = board.hasSel && board.hasSel() ? board.selObj() : null;
    var turnable = selObj && (selObj.dir != null || selObj.deg != null);
    var or = railSection(turnable ? 'Facing of the selected piece' : 'Facing of the next piece');
    or.appendChild(dial(board, hostId, turnable ? selObj : null));
    or.appendChild(el('p', { class: 'hint', style: 'margin:6px 0 0',
      text: turnable
        ? 'Drag the ball round the ring. It turns as you drag, and settles on the eighths.'
        : 'Sets which way the next piece will face. Select a piece and this turns that instead.' }));

    var sw = el('button', { class: 'switch', type: 'button', 'aria-pressed': board.numbering ? 'true' : 'false',
      'aria-label': 'Number players' });
    sw.addEventListener('click', function () { board.numbering = !board.numbering; buildBoardRail(board, hostId); });
    var nextNo = el('input', { type: 'text', maxlength: 3, class: 'num', style: 'width:64px', value: board.num || '1' });
    nextNo.addEventListener('input', function () { board.num = nextNo.value.trim(); });
    or.appendChild(el('div', { class: 'switchrow' }, [sw, el('span', { text: 'Number players' })]));
    or.appendChild(el('div', { class: 'switchrow' }, [el('span', { class: 'hint', text: 'Next #' }), nextNo]));
    host.appendChild(or);

    // EQUIPMENT
    var eq = railSection('Equipment');
    var et = el('div', { class: 'tiles' });
    [['ball', 'Ball'], ['cone', 'Disc'], ['goal', 'Goal'], ['minigoal', 'Mini-goal'], ['man', 'Mannequin']]
      .forEach(function (x) {
        var b = el('button', { class: 'tile', type: 'button', 'aria-pressed': board.tool === x[0] ? 'true' : 'false',
          html: ico(x[0]) + '<span>' + x[1] + '</span>' });
        b.addEventListener('click', function () { board.tool = x[0]; buildBoardRail(board, hostId); });
        et.appendChild(b);
      });
    eq.appendChild(et);
    host.appendChild(eq);

    // DRAW
    var dr = railSection('Draw');
    var dt = el('div', { class: 'tiles' });
    [['arrow', 'Run'], ['pass', 'Pass'], ['curvepass', 'Curved pass'], ['curve', 'Curved run'], ['dribble', 'Dribble'], ['line', 'Line'], ['dash', 'Dashes'], ['text', 'Label']]
      .forEach(function (x) {
        var b = el('button', { class: 'tile', type: 'button', 'aria-pressed': board.tool === x[0] ? 'true' : 'false',
          html: ico(x[0]) + '<span>' + x[1] + '</span>' });
        b.addEventListener('click', function () { board.tool = x[0]; buildBoardRail(board, hostId); });
        dt.appendChild(b);
      });
    dr.appendChild(dt);
    host.appendChild(dr);

    // ZONES
    var zn = railSection('Zones');
    var zt = el('div', { class: 'tiles' });
    [['zone', 'Rectangle'], ['ellipse', 'Ellipse']].forEach(function (x) {
      var b = el('button', { class: 'tile', type: 'button', 'aria-pressed': board.tool === x[0] ? 'true' : 'false',
        html: ico('zone') + '<span>' + x[1] + '</span>' });
      b.addEventListener('click', function () { board.tool = x[0]; buildBoardRail(board, hostId); });
      zt.appendChild(b);
    });
    zn.appendChild(zt);
    host.appendChild(zn);

    // EDIT
    var ed = railSection('Edit');
    var tt = el('div', { class: 'tiles' });
    [['select', 'Select'], ['erase', 'Erase']].forEach(function (x) {
      var b = el('button', { class: 'tile', type: 'button', 'aria-pressed': board.tool === x[0] ? 'true' : 'false',
        html: ico(x[0]) + '<span>' + x[1] + '</span>' });
      b.addEventListener('click', function () { board.tool = x[0]; buildBoardRail(board, hostId); });
      tt.appendChild(b);
    });
    ed.appendChild(tt);
    if (board.hasSel && board.hasSel()) {
      var selType = board.selType();
      /* an area has corners to drag, a line has ends to aim: they resize the
         same way but they do not turn the same way */
      var isArea = selType === 'zone' || selType === 'ellipse';
      var isLine = !isArea && ['pass', 'arrow', 'dribble', 'line', 'dash', 'curve', 'curvepass'].indexOf(selType) >= 0;
      var selBox = el('div', { style: 'margin-bottom:8px' });
      var selTile = function (label, fn) {
        return el('button', { class: 'tile', type: 'button', text: label,
          onclick: function () { fn(); buildBoardRail(board, hostId); } });
      };
      var subhead = function (t) { return el('p', { class: 'eyebrow', style: 'margin:8px 0 6px', text: t }); };

      selBox.appendChild(el('p', { class: 'eyebrow', style: 'margin:0 0 6px',
        text: 'Selected ' + selType }));
      var sr = el('div', { class: 'tiles' });
      sr.appendChild(selTile('Duplicate', function () { board.duplicateSel(); }));
      if (isLine) {
        sr.appendChild(selTile('\u21ba 15\u00b0', function () { board.rotateSel(-15); }));
        sr.appendChild(selTile('15\u00b0 \u21bb', function () { board.rotateSel(15); }));
        sr.appendChild(selTile('Reverse', function () { board.flipSel(); }));
      }
      sr.appendChild(selTile('Delete', function () { board.deleteSel(); }));
      selBox.appendChild(sr);

      /* This piece only. The board-wide size at the top of the rail stays
         where it is, so one arrow can be longer without every arrow growing. */
      selBox.appendChild(subhead(isLine ? 'Size of this line' : isArea ? 'Size of this area' : 'Size of this piece'));
      var szr = el('div', { class: 'tiles' });
      if (isLine) {
        szr.appendChild(selTile('\u2212 shorter', function () { board.scaleSel(0.85); }));
        szr.appendChild(selTile('+ longer', function () { board.scaleSel(1.18); }));
      } else {
        szr.appendChild(selTile('\u2212 smaller', function () { board.scaleSel(0.85); }));
        szr.appendChild(selTile('+ bigger', function () { board.scaleSel(1.18); }));
      }
      if (isLine || isArea) {
        szr.appendChild(selTile('Thinner', function () { board.weightSel(0.85); }));
        szr.appendChild(selTile('Thicker', function () { board.weightSel(1.18); }));
      }
      if (board.selSize && board.selSize() !== 1) {
        szr.appendChild(selTile('Back to board size', function () { board.resetSelSize(); }));
      }
      selBox.appendChild(szr);

      /* Recolour what is already drawn rather than erasing and doing it again.
         A ball, a goal and a mannequin are drawn in their own colours, so there
         is nothing to change on those. */
      var colorable = ['ball', 'goal', 'minigoal', 'man'].indexOf(selType) < 0;
      if (colorable) {
        selBox.appendChild(subhead('Color of this piece'));
        var sdots = el('div', { class: 'dots' });
        var cur = board.selColor ? board.selColor() : '';
        COLORS.forEach(function (c) {
          var b = el('button', { class: 'dot', type: 'button', title: c,
            style: 'background:' + window.Board.HEX[c], 'aria-pressed': cur === c ? 'true' : 'false' });
          b.addEventListener('click', function () { board.colorSel(c, true); buildBoardRail(board, hostId); });
          sdots.appendChild(b);
        });
        /* and one swatch that is any colour at all. It draws live as the picker
           moves, then lands in the undo stack once, when the picker closes. */
        var free = el('input', { class: 'dot', type: 'color', title: 'Any color',
          style: 'padding:2px;background:none',
          value: (window.Board.hexOf ? window.Board.hexOf(cur) : (window.Board.HEX[cur] || cur || '#ffffff')) });
        var live = false;
        free.addEventListener('input', function () {
          if (!live) { board.snap(); live = true; }
          board.colorSel(free.value, false);
        });
        free.addEventListener('change', function () {
          board.colorSel(free.value, !live);
          if (live) { live = false; board._changed(); }
          var kids = sdots.children;
          for (var i = 0; i < kids.length; i++) kids[i].setAttribute('aria-pressed', 'false');
        });
        sdots.appendChild(free);
        selBox.appendChild(sdots);
      }

      selBox.appendChild(el('p', { class: 'hint', style: 'margin:8px 0 0',
        text: (isLine ? 'Or drag either end to re-aim it. '
          : isArea ? 'Drag it to move it, or drag a corner to reshape it. '
            : 'Drag to move it. Use the facing grid above to turn it. ') +
          'Ctrl+D duplicates the selection, Delete removes it.' }));
      ed.appendChild(selBox);
    }

    var row = el('div', { class: 'tiles', style: 'margin-top:8px' });
    row.appendChild(el('button', { class: 'tile', type: 'button', text: 'Undo',
      onclick: function () { board.undo(); buildBoardRail(board, hostId); } }));
    row.appendChild(el('button', { class: 'tile', type: 'button', text: 'Redo',
      onclick: function () { board.redo(); buildBoardRail(board, hostId); } }));
    ed.appendChild(row);
    ed.appendChild(el('button', { class: 'btn warn sm', style: 'margin-top:8px;width:100%;justify-content:center',
      text: 'Clear the board', onclick: function () {
        if (confirm('Clear everything on this diagram?')) { board.clear(); buildBoardRail(board, hostId); }
      } }));
    host.appendChild(ed);
  }


  w.buildBoardRail = function (board, hostId) { ready(); return buildBoardRail(board, hostId); };
  w.boardIcon = function (k, c) { return ico(k, c); };
})(window);

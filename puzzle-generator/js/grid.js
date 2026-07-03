// Canvas grid renderer — AlienSpace1 style with game textures
import { cellName, parseCell, parseCellList } from './cell-utils.js';
import { ZONE_COLORS } from './puzzle-model.js';

// Value colors from domino_piece.gd VALUE_COLORS
const VALUE_COLORS = [
  '#262626',  // 0 - dark gray
  '#F14B6B',  // 1 - pink
  '#F56E2D',  // 2 - orange
  '#279187',  // 3 - teal
  '#E82421',  // 4 - red
  '#3FB1D5',  // 5 - sky blue
  '#00A767',  // 6 - green
  '#2654A5',  // 7 - dark blue
  '#FFC700',  // 8 - yellow
  '#8D412D',  // 9 - brown
  '#B0B0B0',  // 10 - gray
  '#853FFF',  // 11 - purple
  '#9DE53E',  // 12 - lime
];

// Dot positions from DOT_MAP (normalized 0-1 within half)
const DOT_MAP = [
  [],
  [[0.5, 0.5]],
  [[0.28, 0.28], [0.72, 0.72]],
  [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
  [[0.28, 0.18], [0.72, 0.18], [0.28, 0.5], [0.5, 0.5], [0.72, 0.5], [0.28, 0.82], [0.72, 0.82]],
  [[0.22, 0.18], [0.5, 0.18], [0.78, 0.18], [0.22, 0.5], [0.78, 0.5], [0.22, 0.82], [0.5, 0.82], [0.78, 0.82]],
  [[0.22, 0.18], [0.5, 0.18], [0.78, 0.18], [0.22, 0.5], [0.5, 0.5], [0.78, 0.5], [0.22, 0.82], [0.5, 0.82], [0.78, 0.82]],
  [[0.2, 0.15], [0.5, 0.15], [0.8, 0.15], [0.2, 0.4], [0.5, 0.4], [0.8, 0.4], [0.2, 0.65], [0.5, 0.65], [0.8, 0.65], [0.5, 0.88]],
  [[0.2, 0.15], [0.5, 0.15], [0.8, 0.15], [0.2, 0.4], [0.5, 0.4], [0.8, 0.4], [0.2, 0.65], [0.5, 0.65], [0.8, 0.65], [0.35, 0.88], [0.65, 0.88]],
  [[0.2, 0.12], [0.5, 0.12], [0.8, 0.12], [0.2, 0.37], [0.5, 0.37], [0.8, 0.37], [0.2, 0.62], [0.5, 0.62], [0.8, 0.62], [0.2, 0.87], [0.5, 0.87], [0.8, 0.87]],
];

// Zone colors matching gameplay.gd (RGB 0-1 converted to hex)
const GAME_ZONE_COLORS = [
  '#2666BF', '#BF4033', '#2E8C4D', '#B3801A', '#8033A6',
  '#008C8C', '#B34073', '#668C1F', '#995926', '#4040B3',
  '#8C2626', '#338080', '#99338C', '#597333', '#8059B3',
  '#A67340', '#335980', '#8C4D4D', '#4D8026', '#734080',
  '#267373', '#A64D1A', '#59338C', '#808033', '#4D2666',
  '#268C59', '#8C3359', '#66668C', '#996666', '#40734D',
];

export class GridRenderer {
  constructor(canvas, model) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.model = model;
    this.margin = 20;
    this._images = {};
    this._imagesLoaded = false;

    canvas.addEventListener('click', e => this._onClick(e));
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); this._onRightClick(e); });

    this._monsterDialogCallback = null;
    model.on('change', () => this.draw());
    model.on('grid-change', () => this.draw());
    this._loadImages();
    this._setupResize();
  }

  setMonsterDialogCallback(cb) { this._monsterDialogCallback = cb; }

  _loadImages() {
    const assets = {
      boxOpen: 'assets/box_open.png',
      boxClosed: 'assets/box_closed.png',
      gridBg: 'assets/grid_bg.jpg',
      eyeIdle: 'assets/eye_idle.png',
      mouth1: 'assets/mouth_1.png',
    };
    let loaded = 0;
    const total = Object.keys(assets).length;
    for (const [key, src] of Object.entries(assets)) {
      const img = new Image();
      img.onload = () => { loaded++; if (loaded >= total) { this._imagesLoaded = true; this.draw(); } };
      img.onerror = () => { loaded++; if (loaded >= total) { this._imagesLoaded = true; this.draw(); } };
      img.src = src;
      this._images[key] = img;
    }
  }

  _setupResize() {
    const wrapper = document.getElementById('grid-wrapper');
    const ro = new ResizeObserver(() => this._resize());
    ro.observe(wrapper);
    requestAnimationFrame(() => this._resize());
  }

  _resize() {
    const wrapper = document.getElementById('grid-wrapper');
    const dpr = window.devicePixelRatio || 1;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    if (w === 0 || h === 0) return;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  _cellDims() {
    const wrapper = document.getElementById('grid-wrapper');
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    const m = this.margin;
    const cellW = (w - 2 * m) / this.model.gridCols;
    const cellH = (h - 2 * m) / this.model.gridRows;
    return { w, h, cellW, cellH };
  }

  _hitTest(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { cellW, cellH } = this._cellDims();
    const col = Math.floor((x - this.margin) / cellW);
    const row = Math.floor((y - this.margin) / cellH);
    if (col >= 0 && col < this.model.gridCols && row >= 0 && row < this.model.gridRows) {
      return cellName(col, row);
    }
    return null;
  }

  _onClick(e) {
    const cell = this._hitTest(e);
    if (!cell) return;
    const m = this.model;
    if (m.selectedConditionIndex !== null) {
      const cond = m.conditions[m.selectedConditionIndex];
      if (cond) {
        const cells = parseCellList(cond.cells);
        const idx = cells.indexOf(cell);
        if (idx >= 0) cells.splice(idx, 1);
        else cells.push(cell);
        cond.cells = cells.join(', ');
        m.changed();
        m.emit('condition-cells-changed');
      }
      return;
    }
    if (m.getMonsterCellNames().has(cell)) return;
    if (m.blockedCells.has(cell)) m.blockedCells.delete(cell);
    else m.blockedCells.add(cell);
    m.changed();
  }

  _onRightClick(e) {
    const cell = this._hitTest(e);
    if (!cell) return;
    if (this._monsterDialogCallback) this._monsterDialogCallback(cell);
  }

  draw() {
    const ctx = this.ctx;
    const m = this.model;
    const { w, h, cellW, cellH } = this._cellDims();
    const margin = this.margin;

    ctx.clearRect(0, 0, w, h);

    // Background — grid_bg texture or play area color
    if (this._images.gridBg && this._images.gridBg.complete && this._images.gridBg.naturalWidth) {
      ctx.drawImage(this._images.gridBg, 0, 0, w, h);
      // Darken overlay
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#0A2E12'; // COLOR_PLAY_BG from Zyphor palette
      ctx.fillRect(0, 0, w, h);
    }

    const monsters = m.getMonsterCellNames();
    const placementMap = this._buildPlacementMap();
    const zoneCells = this._buildZoneCells();
    const selectedCells = this._getSelectedCells();
    const msMap = {};
    for (const ms of m.monsterSolution) {
      if (ms.monsterCell) msMap[ms.monsterCell] = ms.pieceId;
    }

    const gap = 2; // Gap between cells
    const cornerR = 6; // Corner radius for cells

    // Layer 1: cell backgrounds with box textures
    for (let r = 0; r < m.gridRows; r++) {
      for (let c = 0; c < m.gridCols; c++) {
        const x = margin + c * cellW + gap / 2;
        const y = margin + r * cellH + gap / 2;
        const cw = cellW - gap;
        const ch = cellH - gap;
        const name = cellName(c, r);

        ctx.save();
        this._roundRect(ctx, x, y, cw, ch, cornerR);
        ctx.clip();

        if (m.blockedCells.has(name)) {
          // Closed box texture, darkened
          if (this._images.boxClosed && this._images.boxClosed.complete) {
            ctx.drawImage(this._images.boxClosed, x, y, cw, ch);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(x, y, cw, ch);
          } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x, y, cw, ch);
          }
          // Red X
          ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x + cw * 0.2, y + ch * 0.2); ctx.lineTo(x + cw * 0.8, y + ch * 0.8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + cw * 0.8, y + ch * 0.2); ctx.lineTo(x + cw * 0.2, y + ch * 0.8); ctx.stroke();
        } else if (monsters.has(name)) {
          // Monster cell — dark red bg
          ctx.fillStyle = '#990000';
          ctx.fillRect(x, y, cw, ch);
        } else if (placementMap[name]) {
          // Placed piece — use value color as background (AlienSpace1 style)
          const val = placementMap[name].val;
          ctx.fillStyle = VALUE_COLORS[val] || '#333';
          ctx.fillRect(x, y, cw, ch);
        } else {
          // Empty — open box texture
          if (this._images.boxOpen && this._images.boxOpen.complete) {
            ctx.drawImage(this._images.boxOpen, x, y, cw, ch);
          } else {
            ctx.fillStyle = '#2a3a2a';
            ctx.fillRect(x, y, cw, ch);
          }
        }

        ctx.restore();

        // Cell label (small, top-left)
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${Math.max(8, Math.min(10, cellW * 0.12))}px Fredoka, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(name, x + 3, y + 2);
      }
    }

    // Layer 2: zone overlays
    for (let r = 0; r < m.gridRows; r++) {
      for (let c = 0; c < m.gridCols; c++) {
        const name = cellName(c, r);
        if (zoneCells[name]) {
          const x = margin + c * cellW + gap / 2 + 1;
          const y = margin + r * cellH + gap / 2 + 1;
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = zoneCells[name][0].color;
          this._roundRect(ctx, x, y, cellW - gap - 2, cellH - gap - 2, cornerR);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      }
    }

    // Layer 3: monster content (eyes, mouth, expression)
    for (let r = 0; r < m.gridRows; r++) {
      for (let c = 0; c < m.gridCols; c++) {
        const name = cellName(c, r);
        const monster = m.monsterCells.find(mc => mc.cell === name);
        if (!monster) continue;
        const x = margin + c * cellW + gap / 2;
        const y = margin + r * cellH + gap / 2;
        const cw = cellW - gap;
        const ch = cellH - gap;
        const cx = x + cw / 2;

        // Eyes (1-2) at top area
        const eyeSize = Math.min(cw, ch) * 0.25;
        if (this._images.eyeIdle && this._images.eyeIdle.complete) {
          ctx.drawImage(this._images.eyeIdle, cx - eyeSize * 1.1, y + ch * 0.08, eyeSize, eyeSize);
          ctx.drawImage(this._images.eyeIdle, cx + eyeSize * 0.1, y + ch * 0.08, eyeSize, eyeSize);
        }

        // Mouth in middle
        if (this._images.mouth1 && this._images.mouth1.complete) {
          const mouthSize = Math.min(cw, ch) * 0.4;
          ctx.drawImage(this._images.mouth1, cx - mouthSize / 2, y + ch * 0.35, mouthSize, mouthSize);
        }

        // Expression text at bottom
        const displayText = monster.expression || '?';
        ctx.font = `bold ${Math.max(9, Math.min(14, ch * 0.15))}px Fredoka, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'white';
        ctx.fillText(`${displayText}=${monster.answer}`, cx, y + ch - 3);

        // Sacrifice piece indicator
        if (msMap[name] !== undefined) {
          ctx.font = `${Math.max(7, ch * 0.1)}px Fredoka, sans-serif`;
          ctx.fillStyle = '#AAFFAA';
          ctx.textAlign = 'right'; ctx.textBaseline = 'top';
          ctx.fillText(`P${msMap[name]}`, x + cw - 3, y + 3);
        }
      }
    }

    // Layer 4: solution — draw eyes on placed pieces (AlienSpace1 style)
    for (let r = 0; r < m.gridRows; r++) {
      for (let c = 0; c < m.gridCols; c++) {
        const name = cellName(c, r);
        const p = placementMap[name];
        if (!p) continue;
        const x = margin + c * cellW + gap / 2;
        const y = margin + r * cellH + gap / 2;
        const cw = cellW - gap;
        const ch = cellH - gap;

        const val = p.val;
        const dots = DOT_MAP[val] || [];

        // Draw eyes at dot positions
        if (this._images.eyeIdle && this._images.eyeIdle.complete && dots.length > 0) {
          const count = dots.length;
          let eyeSize;
          if (count <= 1) eyeSize = cw * 0.4;
          else if (count <= 2) eyeSize = cw * 0.34;
          else if (count <= 4) eyeSize = cw * 0.28;
          else if (count <= 6) eyeSize = cw * 0.22;
          else eyeSize = cw * 0.18;

          for (const [dx, dy] of dots) {
            const ex = x + dx * cw - eyeSize / 2;
            const ey = y + dy * ch - eyeSize / 2;
            ctx.drawImage(this._images.eyeIdle, ex, ey, eyeSize, eyeSize);
          }
        }

        // Piece ID label
        ctx.font = `bold ${Math.max(8, ch * 0.13)}px Fredoka, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(`P${p.pid}`, x + cw / 2, y + ch - 2);
      }
    }

    // Layer 5: condition zone dashed borders + tags
    for (let i = 0; i < m.conditions.length; i++) {
      const cond = m.conditions[i];
      const cells = parseCellList(cond.cells);
      if (!cells.length) continue;
      const color = GAME_ZONE_COLORS[i % GAME_ZONE_COLORS.length];
      let lastX2 = 0, lastY2 = 0;
      for (const cn of cells) {
        let cc, cr;
        try { [cc, cr] = parseCell(cn); } catch { continue; }
        const x = margin + cc * cellW + gap / 2 + 2;
        const y = margin + cr * cellH + gap / 2 + 2;
        const cw = cellW - gap - 4;
        const ch = cellH - gap - 4;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([12, 6]);
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        this._roundRect(ctx, x, y, cw, ch, cornerR);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
        lastX2 = x + cw;
        lastY2 = y + ch;
      }
      // Tag badge
      const op = cond.operator;
      let tag;
      if (op === '=') tag = `#${i + 1} =`;
      else tag = `#${i + 1} ${op}${cond.value}`;
      if (lastX2 > 0) {
        const tagFont = `bold ${Math.max(9, cellW * 0.12)}px Fredoka, sans-serif`;
        ctx.font = tagFont;
        const tw = ctx.measureText(tag).width;
        // Tag pill background
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        this._roundRect(ctx, lastX2 - tw - 10, lastY2 - 18, tw + 8, 16, 4);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'white';
        ctx.fillText(tag, lastX2 - 4, lastY2 - 3);
      }
    }

    // Layer 6: selected cells highlight (cyan glow)
    if (selectedCells.size > 0) {
      for (let r = 0; r < m.gridRows; r++) {
        for (let c = 0; c < m.gridCols; c++) {
          const name = cellName(c, r);
          if (!selectedCells.has(name)) continue;
          const x = margin + c * cellW + gap / 2;
          const y = margin + r * cellH + gap / 2;
          ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 3;
          ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 8;
          this._roundRect(ctx, x + 1, y + 1, cellW - gap - 2, cellH - gap - 2, cornerR);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _buildPlacementMap() {
    const map = {};
    for (const s of this.model.solution) {
      if (s.cell1) map[s.cell1] = { pid: s.pieceId, val: s.val1 };
      if (s.cell2) map[s.cell2] = { pid: s.pieceId, val: s.val2 };
    }
    return map;
  }

  _buildZoneCells() {
    const map = {};
    for (let i = 0; i < this.model.conditions.length; i++) {
      const color = GAME_ZONE_COLORS[i % GAME_ZONE_COLORS.length];
      const cells = parseCellList(this.model.conditions[i].cells);
      for (const cn of cells) {
        (map[cn] ||= []).push({ idx: i, color });
      }
    }
    return map;
  }

  _getSelectedCells() {
    const m = this.model;
    if (m.selectedConditionIndex === null) return new Set();
    const cond = m.conditions[m.selectedConditionIndex];
    if (!cond) return new Set();
    return new Set(parseCellList(cond.cells));
  }
}

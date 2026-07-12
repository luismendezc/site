// Play mode — test puzzles in-browser
import { cellName, parseCell, parseCellList, areCellsAdjacent } from './cell-utils.js';

// Value colors from grid.js
const VALUE_COLORS = [
  '#262626','#F14B6B','#F56E2D','#279187','#E82421','#3FB1D5',
  '#00A767','#2654A5','#FFC700','#8D412D','#B0B0B0','#853FFF','#9DE53E',
];

const DOT_MAP = [
  [],
  [[0.5,0.5]],
  [[0.28,0.28],[0.72,0.72]],
  [[0.28,0.28],[0.5,0.5],[0.72,0.72]],
  [[0.28,0.28],[0.72,0.28],[0.28,0.72],[0.72,0.72]],
  [[0.28,0.28],[0.72,0.28],[0.5,0.5],[0.28,0.72],[0.72,0.72]],
  [[0.28,0.22],[0.72,0.22],[0.28,0.5],[0.72,0.5],[0.28,0.78],[0.72,0.78]],
  [[0.28,0.18],[0.72,0.18],[0.28,0.5],[0.5,0.5],[0.72,0.5],[0.28,0.82],[0.72,0.82]],
  [[0.22,0.18],[0.5,0.18],[0.78,0.18],[0.22,0.5],[0.78,0.5],[0.22,0.82],[0.5,0.82],[0.78,0.82]],
  [[0.22,0.18],[0.5,0.18],[0.78,0.18],[0.22,0.5],[0.5,0.5],[0.78,0.5],[0.22,0.82],[0.5,0.82],[0.78,0.82]],
  [[0.2,0.15],[0.5,0.15],[0.8,0.15],[0.2,0.4],[0.5,0.4],[0.8,0.4],[0.2,0.65],[0.5,0.65],[0.8,0.65],[0.5,0.88]],
  [[0.2,0.15],[0.5,0.15],[0.8,0.15],[0.2,0.4],[0.5,0.4],[0.8,0.4],[0.2,0.65],[0.5,0.65],[0.8,0.65],[0.35,0.88],[0.65,0.88]],
  [[0.2,0.12],[0.5,0.12],[0.8,0.12],[0.2,0.37],[0.5,0.37],[0.8,0.37],[0.2,0.62],[0.5,0.62],[0.8,0.62],[0.2,0.87],[0.5,0.87],[0.8,0.87]],
];

const ZONE_COLORS = [
  '#2666BF','#BF4033','#2E8C4D','#B3801A','#8033A6',
  '#008C8C','#B34073','#668C1F','#995926','#4040B3',
];

export class PuzzlePlayer {
  constructor(modalEl, puzzleData) {
    this.modal = modalEl;
    this.data = puzzleData;
    this.rows = puzzleData.grid_rows;
    this.cols = puzzleData.grid_cols;
    this.blocked = new Set(puzzleData.blocked_cells || []);
    this.monsters = new Map();
    for (const m of (puzzleData.monster_cells || [])) {
      this.monsters.set(m.cell, { expression: m.expression, display: m.display, answer: m.answer });
    }
    this.pieces = (puzzleData.pieces || []).map(p => ({ ...p }));
    this.conditions = puzzleData.conditions || [];
    this.lives = puzzleData.lives || 3;
    this.maxLives = this.lives;

    // State
    this.grid = new Map(); // cell -> { pieceId, val }
    this.placedPieces = new Map(); // pieceId -> { cell1, cell2, val1, val2 }
    this.monsterFeedings = new Map(); // monsterCell -> pieceId
    this.tray = this.pieces.map(p => p.id);
    this.selectedPiece = null; // pieceId currently selected from tray
    this.firstCell = null; // first cell clicked for placement
    this.gameOver = false;
    this.won = false;
    this.failedConditions = new Set();

    this._images = {};
    this._imagesLoaded = false;

    this._setup();
  }

  _setup() {
    this._loadImages();
    const gridCanvas = this.modal.querySelector('#play-grid');
    const trayCanvas = this.modal.querySelector('#play-tray');
    this.gridCtx = gridCanvas.getContext('2d');
    this.trayCtx = trayCanvas.getContext('2d');
    this.gridCanvas = gridCanvas;
    this.trayCanvas = trayCanvas;

    // Lives display
    this._updateLives();

    // Events
    gridCanvas.addEventListener('click', e => this._onGridClick(e));
    gridCanvas.addEventListener('contextmenu', e => { e.preventDefault(); this._onGridRightClick(e); });
    trayCanvas.addEventListener('click', e => this._onTrayClick(e));

    // Buttons
    this.modal.querySelector('#play-check').addEventListener('click', () => this._onCheck());
    this.modal.querySelector('#play-reset').addEventListener('click', () => this._onReset());

    this._resizeCanvases();
    window.addEventListener('resize', () => this._resizeCanvases());
  }

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
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= total) { this._imagesLoaded = true; this.draw(); }
      };
      img.src = src;
      this._images[key] = img;
    }
  }

  _resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;

    // Grid
    const gw = this.gridCanvas.parentElement;
    const w = gw.clientWidth;
    const h = gw.clientHeight || 400;
    this.gridCanvas.width = w * dpr;
    this.gridCanvas.height = h * dpr;
    this.gridCanvas.style.width = w + 'px';
    this.gridCanvas.style.height = h + 'px';
    this.gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Tray
    const tw = this.trayCanvas.parentElement;
    const tw2 = tw.clientWidth;
    const th = tw.clientHeight || 120;
    this.trayCanvas.width = tw2 * dpr;
    this.trayCanvas.height = th * dpr;
    this.trayCanvas.style.width = tw2 + 'px';
    this.trayCanvas.style.height = th + 'px';
    this.trayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.draw();
  }

  draw() {
    this._drawGrid();
    this._drawTray();
  }

  _drawGrid() {
    const ctx = this.gridCtx;
    const canvas = this.gridCanvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const margin = 16;
    const cellW = (w - 2 * margin) / this.cols;
    const cellH = (h - 2 * margin) / this.rows;
    const gap = 2;
    const cornerR = 6;

    ctx.clearRect(0, 0, w, h);

    // Background
    if (this._images.gridBg?.complete && this._images.gridBg.naturalWidth) {
      ctx.drawImage(this._images.gridBg, 0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#0A2E12';
      ctx.fillRect(0, 0, w, h);
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = margin + c * cellW + gap / 2;
        const y = margin + r * cellH + gap / 2;
        const cw = cellW - gap;
        const ch = cellH - gap;
        const name = cellName(c, r);

        ctx.save();
        this._roundRect(ctx, x, y, cw, ch, cornerR);
        ctx.clip();

        if (this.blocked.has(name)) {
          if (this._images.boxClosed?.complete) {
            ctx.drawImage(this._images.boxClosed, x, y, cw, ch);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(x, y, cw, ch);
          } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x, y, cw, ch);
          }
          ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x + cw * 0.2, y + ch * 0.2); ctx.lineTo(x + cw * 0.8, y + ch * 0.8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + cw * 0.8, y + ch * 0.2); ctx.lineTo(x + cw * 0.2, y + ch * 0.8); ctx.stroke();
        } else if (this.monsters.has(name)) {
          // Monster — check if fed
          if (this.monsterFeedings.has(name)) {
            ctx.fillStyle = '#336633';
            ctx.fillRect(x, y, cw, ch);
          } else {
            ctx.fillStyle = '#990000';
            ctx.fillRect(x, y, cw, ch);
          }
        } else if (this.grid.has(name)) {
          const val = this.grid.get(name).val;
          ctx.fillStyle = VALUE_COLORS[val] || '#333';
          ctx.fillRect(x, y, cw, ch);
        } else {
          if (this._images.boxOpen?.complete) {
            ctx.drawImage(this._images.boxOpen, x, y, cw, ch);
          } else {
            ctx.fillStyle = '#2a3a2a';
            ctx.fillRect(x, y, cw, ch);
          }
        }
        ctx.restore();

        // Cell label
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = `${Math.max(8, Math.min(10, cellW * 0.12))}px Fredoka, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(name, x + 3, y + 2);
      }
    }

    // Draw eyes on placed pieces
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const name = cellName(c, r);
        const p = this.grid.get(name);
        if (!p) continue;
        const x = margin + c * cellW + gap / 2;
        const y = margin + r * cellH + gap / 2;
        const cw = cellW - gap;
        const ch = cellH - gap;
        const dots = DOT_MAP[p.val] || [];
        if (this._images.eyeIdle?.complete && dots.length > 0) {
          const count = dots.length;
          let eyeSize;
          if (count <= 1) eyeSize = cw * 0.4;
          else if (count <= 2) eyeSize = cw * 0.34;
          else if (count <= 4) eyeSize = cw * 0.28;
          else if (count <= 6) eyeSize = cw * 0.22;
          else eyeSize = cw * 0.18;
          for (const [dx, dy] of dots) {
            ctx.drawImage(this._images.eyeIdle, x + dx * cw - eyeSize / 2, y + dy * ch - eyeSize / 2, eyeSize, eyeSize);
          }
        }
      }
    }

    // Draw monster content
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const name = cellName(c, r);
        const monster = this.monsters.get(name);
        if (!monster) continue;
        const x = margin + c * cellW + gap / 2;
        const y = margin + r * cellH + gap / 2;
        const cw = cellW - gap;
        const ch = cellH - gap;
        const cx = x + cw / 2;

        if (this.monsterFeedings.has(name)) {
          // Fed — show checkmark
          ctx.font = `bold ${Math.max(16, ch * 0.4)}px Fredoka, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#00FF88';
          ctx.fillText('✓', cx, y + ch / 2);
        } else {
          // Eyes
          const eyeSize = Math.min(cw, ch) * 0.25;
          if (this._images.eyeIdle?.complete) {
            ctx.drawImage(this._images.eyeIdle, cx - eyeSize * 1.1, y + ch * 0.08, eyeSize, eyeSize);
            ctx.drawImage(this._images.eyeIdle, cx + eyeSize * 0.1, y + ch * 0.08, eyeSize, eyeSize);
          }
          if (this._images.mouth1?.complete) {
            const mouthSize = Math.min(cw, ch) * 0.4;
            ctx.drawImage(this._images.mouth1, cx - mouthSize / 2, y + ch * 0.35, mouthSize, mouthSize);
          }
          // Display expression (NOT the answer)
          const displayText = monster.display || monster.expression || '?';
          ctx.font = `bold ${Math.max(9, Math.min(14, ch * 0.15))}px Fredoka, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillStyle = 'white';
          ctx.fillText(displayText, cx, y + ch - 3);
        }
      }
    }

    // Condition zone borders
    for (let i = 0; i < this.conditions.length; i++) {
      const cond = this.conditions[i];
      const cells = cond.cells || [];
      if (!cells.length) continue;
      const color = ZONE_COLORS[i % ZONE_COLORS.length];
      const failed = this.failedConditions.has(i);
      let lastX2 = 0, lastY2 = 0;
      for (const cn of cells) {
        let cc, cr;
        try { [cc, cr] = parseCell(cn); } catch { continue; }
        const x = margin + cc * cellW + gap / 2 + 2;
        const y = margin + cr * cellH + gap / 2 + 2;
        const cw2 = cellW - gap - 4;
        const ch2 = cellH - gap - 4;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.setLineDash([12, 6]);
        ctx.strokeStyle = failed ? '#FF3333' : color;
        ctx.lineWidth = failed ? 4 : 3;
        this._roundRect(ctx, x, y, cw2, ch2, cornerR);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
        lastX2 = x + cw2;
        lastY2 = y + ch2;
      }
      // Tag
      const op = cond.operator;
      let tag;
      if (op === '=') tag = `#${i + 1} =`;
      else if (op === 'sum') tag = `#${i + 1} Σ${cond.value}`;
      else tag = `#${i + 1} ${op}${cond.value}`;
      if (lastX2 > 0) {
        ctx.font = `bold ${Math.max(9, cellW * 0.12)}px Fredoka, sans-serif`;
        const tw = ctx.measureText(tag).width;
        ctx.fillStyle = failed ? '#CC0000' : color;
        ctx.globalAlpha = 0.85;
        this._roundRect(ctx, lastX2 - tw - 10, lastY2 - 18, tw + 8, 16, 4);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'white';
        ctx.fillText(tag, lastX2 - 4, lastY2 - 3);
      }
    }

    // Highlight firstCell if selecting
    if (this.firstCell) {
      try {
        const [cc, cr] = parseCell(this.firstCell);
        const x = margin + cc * cellW + gap / 2;
        const y = margin + cr * cellH + gap / 2;
        ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 3;
        ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 10;
        this._roundRect(ctx, x + 1, y + 1, cellW - gap - 2, cellH - gap - 2, cornerR);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } catch {}
    }

    // Win / Game Over overlay
    if (this.won) {
      ctx.fillStyle = 'rgba(0,167,103,0.3)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 28px Fredoka, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#00FF88';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
      ctx.fillText('¡Puzzle Completado!', w / 2, h / 2);
      ctx.shadowBlur = 0;
    } else if (this.gameOver) {
      ctx.fillStyle = 'rgba(191,26,26,0.3)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 28px Fredoka, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FF4444';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
      ctx.fillText('Game Over', w / 2, h / 2);
      ctx.shadowBlur = 0;
    }
  }

  _drawTray() {
    const ctx = this.trayCtx;
    const w = this.trayCanvas.clientWidth;
    const h = this.trayCanvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0D0D2E';
    ctx.fillRect(0, 0, w, h);

    const pieceW = 100;
    const pieceH = 50;
    const pad = 10;
    const perRow = Math.max(1, Math.floor((w - pad) / (pieceW + pad)));

    const trayPieces = this.tray.map(id => this.pieces.find(p => p.id === id)).filter(Boolean);

    for (let i = 0; i < trayPieces.length; i++) {
      const p = trayPieces[i];
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = pad + col * (pieceW + pad);
      const y = pad + row * (pieceH + pad);

      const selected = this.selectedPiece === p.id;

      // Background
      ctx.fillStyle = selected ? 'rgba(0,255,255,0.15)' : 'rgba(30,30,80,0.8)';
      this._roundRect(ctx, x, y, pieceW, pieceH, 8);
      ctx.fill();

      // Border
      ctx.strokeStyle = selected ? '#00FFFF' : 'rgba(63,177,213,0.3)';
      ctx.lineWidth = selected ? 2 : 1;
      if (selected) { ctx.shadowColor = '#00FFFF'; ctx.shadowBlur = 8; }
      this._roundRect(ctx, x, y, pieceW, pieceH, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Left half
      const halfW = pieceW / 2;
      ctx.fillStyle = VALUE_COLORS[p.left] || '#333';
      this._roundRect(ctx, x + 1, y + 1, halfW - 2, pieceH - 2, 6);
      ctx.fill();

      // Right half
      ctx.fillStyle = VALUE_COLORS[p.right] || '#333';
      this._roundRect(ctx, x + halfW + 1, y + 1, halfW - 2, pieceH - 2, 6);
      ctx.fill();

      // Eyes on left half
      const leftDots = DOT_MAP[p.left] || [];
      const rightDots = DOT_MAP[p.right] || [];
      if (this._images.eyeIdle?.complete) {
        const drawDots = (dots, ox, oy, dw, dh) => {
          const count = dots.length;
          let sz;
          if (count <= 1) sz = dw * 0.4;
          else if (count <= 3) sz = dw * 0.28;
          else sz = dw * 0.22;
          for (const [dx, dy] of dots) {
            ctx.drawImage(this._images.eyeIdle, ox + dx * dw - sz / 2, oy + dy * dh - sz / 2, sz, sz);
          }
        };
        drawDots(leftDots, x, y, halfW, pieceH);
        drawDots(rightDots, x + halfW, y, halfW, pieceH);
      }

      // Divider
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + halfW, y + 4);
      ctx.lineTo(x + halfW, y + pieceH - 4);
      ctx.stroke();

      // Piece ID
      ctx.font = 'bold 9px Fredoka, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(`P${p.id}`, x + pieceW / 2, y + pieceH - 2);
    }

    // Store layout for hit testing
    this._trayLayout = trayPieces.map((p, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      return {
        id: p.id,
        x: pad + col * (pieceW + pad),
        y: pad + row * (pieceH + pad),
        w: pieceW,
        h: pieceH,
      };
    });
  }

  _onTrayClick(e) {
    if (this.gameOver || this.won) return;
    const rect = this.trayCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const item of (this._trayLayout || [])) {
      if (mx >= item.x && mx <= item.x + item.w && my >= item.y && my <= item.y + item.h) {
        if (this.selectedPiece === item.id) {
          this.selectedPiece = null; // deselect
        } else {
          this.selectedPiece = item.id;
        }
        this.firstCell = null;
        this.draw();
        return;
      }
    }
  }

  _onGridClick(e) {
    if (this.gameOver || this.won) return;
    const cell = this._gridHitTest(e);
    if (!cell) return;

    // If clicking a monster cell — feed it
    if (this.monsters.has(cell)) {
      if (this.monsterFeedings.has(cell)) {
        // Unfeed — return piece to tray
        const pid = this.monsterFeedings.get(cell);
        this.monsterFeedings.delete(cell);
        this.tray.push(pid);
        this.draw();
        return;
      }
      if (this.selectedPiece !== null) {
        this.monsterFeedings.set(cell, this.selectedPiece);
        this.tray = this.tray.filter(id => id !== this.selectedPiece);
        this.selectedPiece = null;
        this.firstCell = null;
        this.draw();
        return;
      }
      return;
    }

    if (this.blocked.has(cell)) return;

    // If clicking a placed piece — pick it up
    if (this.grid.has(cell)) {
      const placed = this.grid.get(cell);
      const pid = placed.pieceId;
      const placement = this.placedPieces.get(pid);
      if (placement) {
        this.grid.delete(placement.cell1);
        this.grid.delete(placement.cell2);
        this.placedPieces.delete(pid);
        this.tray.push(pid);
        this.draw();
      }
      return;
    }

    // Placing a piece
    if (this.selectedPiece === null) return;

    if (this.firstCell === null) {
      // First click — set first cell
      this.firstCell = cell;
      this.draw();
      return;
    }

    // Second click — place the piece
    const c1 = this.firstCell;
    const c2 = cell;
    this.firstCell = null;

    if (!areCellsAdjacent(c1, c2)) {
      // Not adjacent — restart
      this.firstCell = cell;
      this.draw();
      return;
    }

    if (this.grid.has(c2) || this.blocked.has(c2) || this.monsters.has(c2)) {
      this.firstCell = null;
      this.draw();
      return;
    }

    const piece = this.pieces.find(p => p.id === this.selectedPiece);
    if (!piece) return;

    // Place: first cell gets left value, second gets right
    this.grid.set(c1, { pieceId: piece.id, val: piece.left });
    this.grid.set(c2, { pieceId: piece.id, val: piece.right });
    this.placedPieces.set(piece.id, { cell1: c1, cell2: c2, val1: piece.left, val2: piece.right });

    this.tray = this.tray.filter(id => id !== piece.id);
    this.selectedPiece = null;
    this.draw();
  }

  _onGridRightClick(e) {
    if (this.gameOver || this.won) return;
    const cell = this._gridHitTest(e);
    if (!cell) return;

    // Right-click placed piece: rotate (swap values)
    if (this.grid.has(cell)) {
      const placed = this.grid.get(cell);
      const pid = placed.pieceId;
      const placement = this.placedPieces.get(pid);
      if (placement) {
        // Swap val1 and val2
        const tmp = placement.val1;
        placement.val1 = placement.val2;
        placement.val2 = tmp;
        this.grid.set(placement.cell1, { pieceId: pid, val: placement.val1 });
        this.grid.set(placement.cell2, { pieceId: pid, val: placement.val2 });
        this.draw();
      }
      return;
    }

    // Right-click monster: unfeed
    if (this.monsterFeedings.has(cell)) {
      const pid = this.monsterFeedings.get(cell);
      this.monsterFeedings.delete(cell);
      this.tray.push(pid);
      this.draw();
    }
  }

  _onCheck() {
    if (this.gameOver || this.won) return;

    // Check all conditions
    const cellValues = {};
    for (const [cell, data] of this.grid) {
      cellValues[cell] = data.val;
    }

    this.failedConditions.clear();
    let allPass = true;

    // Check monster feedings
    for (const [cell, monster] of this.monsters) {
      if (!this.monsterFeedings.has(cell)) {
        allPass = false;
        break;
      }
      const pid = this.monsterFeedings.get(cell);
      const piece = this.pieces.find(p => p.id === pid);
      if (!piece || piece.left + piece.right !== monster.answer) {
        allPass = false;
        break;
      }
    }

    // Check all pieces placed
    if (this.tray.length > 0) allPass = false;

    // Check conditions
    for (let i = 0; i < this.conditions.length; i++) {
      const cond = this.conditions[i];
      const cells = cond.cells || [];
      const values = cells.map(c => cellValues[c] ?? 0);
      const op = cond.operator;
      const val = cond.value;
      let pass = false;

      if (op === '=') {
        pass = values.length >= 2 && new Set(values).size === 1;
      } else if (op === 'sum') {
        pass = values.reduce((a, b) => a + b, 0) === val;
      } else {
        const s = cells.length > 1 ? values.reduce((a, b) => a + b, 0) : values[0];
        if (op === '>') pass = s > val;
        else if (op === '<') pass = s < val;
        else if (op === '>=') pass = s >= val;
        else if (op === '<=') pass = s <= val;
      }

      if (!pass) {
        this.failedConditions.add(i);
        allPass = false;
      }
    }

    if (allPass) {
      this.won = true;
      this.draw();
      this._showMessage('¡Puzzle Completado! 🎉', 'success');
    } else {
      this.lives--;
      this._updateLives();
      if (this.lives <= 0) {
        this.gameOver = true;
        this.draw();
        this._showMessage('Game Over — Sin vidas', 'danger');
      } else {
        this.draw();
        this._showMessage(`Incorrecto — ${this.lives} vida(s) restante(s)`, 'warning');
        // Shake animation
        this.gridCanvas.classList.add('shake');
        setTimeout(() => this.gridCanvas.classList.remove('shake'), 500);
        // Clear failed highlights after 2s
        setTimeout(() => { this.failedConditions.clear(); this.draw(); }, 2000);
      }
    }
  }

  _onReset() {
    this.grid.clear();
    this.placedPieces.clear();
    this.monsterFeedings.clear();
    this.tray = this.pieces.map(p => p.id);
    this.selectedPiece = null;
    this.firstCell = null;
    this.failedConditions.clear();

    if (this.gameOver) {
      this.gameOver = false;
      this.lives = this.maxLives;
      this._updateLives();
    }
    this.won = false;

    this._hideMessage();
    this.draw();
  }

  _updateLives() {
    const el = this.modal.querySelector('#play-lives');
    if (el) {
      el.innerHTML = '';
      for (let i = 0; i < this.maxLives; i++) {
        const span = document.createElement('span');
        span.textContent = i < this.lives ? '❤️' : '🖤';
        span.style.fontSize = '1.2rem';
        span.style.marginRight = '2px';
        el.appendChild(span);
      }
    }
  }

  _showMessage(text, type) {
    const el = this.modal.querySelector('#play-message');
    if (el) {
      el.textContent = text;
      el.className = `play-message play-message-${type}`;
      el.classList.remove('d-none');
    }
  }

  _hideMessage() {
    const el = this.modal.querySelector('#play-message');
    if (el) el.classList.add('d-none');
  }

  _gridHitTest(e) {
    const rect = this.gridCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const margin = 16;
    const cellW = (this.gridCanvas.clientWidth - 2 * margin) / this.cols;
    const cellH = (this.gridCanvas.clientHeight - 2 * margin) / this.rows;
    const col = Math.floor((x - margin) / cellW);
    const row = Math.floor((y - margin) / cellH);
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      return cellName(col, row);
    }
    return null;
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

  destroy() {
    window.removeEventListener('resize', this._resizeCanvases);
  }
}

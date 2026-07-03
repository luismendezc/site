// Central data model with event emitter

export const ZONE_COLORS = [
  "#8B0000", "#006400", "#00008B", "#8B8B00", "#8B008B",
  "#008B8B", "#4B0082", "#2F4F4F", "#8B4513", "#556B2F",
  "#483D8B", "#B8860B", "#2E8B57", "#8B0040", "#36648B",
  "#6B4226", "#228B22", "#4A708B", "#8B6914", "#5F9EA0",
  "#9B30FF", "#8B3A3A", "#528B8B", "#8B7500", "#CD6090",
  "#6E8B3D", "#8B5A2B", "#698B69", "#8B636C", "#7A8B8B",
];

export const DIFFICULTY_GRIDS = {
  extra_facil: [4, 4],
  facil: [4, 4],
  medio_bajo: [5, 5],
  medio_alto: [5, 5],
  dificil_bajo: [5, 5],
  dificil_alto: [5, 5],
};

export const DIFFICULTY_INFO = {
  extra_facil: ["Extra Fácil", "Cuadrícula 4×4 · 10 pts · 2-3 piezas, 1-2 condiciones simples, sin monstruos."],
  facil: ["Fácil", "Cuadrícula 4×4 · 20 pts · 3-4 piezas, 2-3 condiciones, 0-1 monstruos."],
  medio_bajo: ["Medio Bajo", "Cuadrícula 5×5 · 50 pts · 4-5 piezas, 3-4 condiciones, 0-1 monstruos."],
  medio_alto: ["Medio Alto", "Cuadrícula 5×5 · 100 pts · 5-6 piezas, 4-5 condiciones, 1-2 monstruos."],
  dificil_bajo: ["Difícil Bajo", "Cuadrícula 5×5 · 150 pts · 6-7 piezas, 5-6 condiciones, 1-2 monstruos."],
  dificil_alto: ["Difícil Alto", "Cuadrícula 5×5 · 200 pts · 7+ piezas, 6+ condiciones, 2+ monstruos."],
};

export const DIFFICULTY_LIMITS = {
  extra_facil: [2, 3, 1, 2, 0, 0],
  facil:       [3, 4, 2, 3, 0, 2],
  medio_bajo:  [4, 5, 3, 4, 0, 4],
  medio_alto:  [5, 6, 4, 5, 0, 6],
  dificil_bajo:[6, 7, 5, 6, 0, 8],
  dificil_alto:[7, 12, 6, 12, 0, 10],
};

export class PuzzleModel {
  constructor() {
    this._listeners = {};
    this.difficulty = 'facil';
    this.gridRows = 4;
    this.gridCols = 4;
    this.puzzleId = 1;
    this.blockedCells = new Set();
    this.pieces = [];
    this.solution = [];
    this.conditions = [];
    this.monsterCells = [];
    this.monsterSolution = [];
    this.selectedConditionIndex = null;
  }

  on(event, fn) {
    (this._listeners[event] ||= []).push(fn);
  }

  emit(event) {
    for (const fn of this._listeners[event] || []) fn();
  }

  // Full rebuild — tabs + grid
  changed() { this.emit('change'); }

  // Grid-only redraw — no tab rebuild, preserves focus
  gridChanged() { this.emit('grid-change'); }

  setDifficulty(d) {
    this.difficulty = d;
    const g = DIFFICULTY_GRIDS[d];
    if (g) { this.gridRows = g[0]; this.gridCols = g[1]; }
    this._pruneToGrid();
    this.changed();
  }

  _pruneToGrid() {
    const valid = this.allCellNames();
    this.blockedCells = new Set([...this.blockedCells].filter(c => valid.has(c)));
    this.monsterCells = this.monsterCells.filter(m => valid.has(m.cell));
  }

  allCellNames() {
    const s = new Set();
    for (let r = 0; r < this.gridRows; r++)
      for (let c = 0; c < this.gridCols; c++)
        s.add(String.fromCharCode(65 + r) + (c + 1));
    return s;
  }

  getMonsterCellNames() {
    return new Set(this.monsterCells.map(m => m.cell).filter(Boolean));
  }

  getAvailableCells() {
    const monsters = this.getMonsterCellNames();
    const cells = [];
    for (let r = 0; r < this.gridRows; r++)
      for (let c = 0; c < this.gridCols; c++) {
        const name = String.fromCharCode(65 + r) + (c + 1);
        if (!this.blockedCells.has(name) && !monsters.has(name)) cells.push(name);
      }
    return cells;
  }

  getPieceIds() {
    return this.pieces.map(p => p.id);
  }

  nextPieceId() {
    if (!this.pieces.length) return 1;
    return Math.max(...this.pieces.map(p => p.id)) + 1;
  }
}

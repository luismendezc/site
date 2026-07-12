// Random puzzle generator
import { DIFFICULTY_LIMITS, DIFFICULTY_GRIDS } from './puzzle-model.js';
import { cellName, parseCell, areCellsAdjacent, computeRotation, parseCellList } from './cell-utils.js';
import { validate, prove } from './validation.js';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getAdjacentCells(cell, rows, cols) {
  const [col, row] = parseCell(cell);
  const adj = [];
  if (row > 0) adj.push(cellName(col, row - 1));
  if (row < rows - 1) adj.push(cellName(col, row + 1));
  if (col > 0) adj.push(cellName(col - 1, row));
  if (col < cols - 1) adj.push(cellName(col + 1, row));
  return adj;
}

function generateExpression(answer) {
  // Generate a math expression that evaluates to answer
  const ops = ['+', '-', '*'];
  const op = ops[randInt(0, ops.length - 1)];
  let a, b, expr, display;

  if (op === '+') {
    a = randInt(0, answer);
    b = answer - a;
    expr = `${a}+${b}`;
    display = `${a}+${b}`;
  } else if (op === '-') {
    b = randInt(1, 12);
    a = answer + b;
    if (a > 24) { a = answer; b = 0; }
    expr = `${a}-${b}`;
    display = `${a}−${b}`;
  } else {
    // multiplication: find factors
    const factors = [];
    for (let i = 1; i <= 12; i++) {
      if (answer % i === 0 && answer / i <= 12) {
        factors.push([i, answer / i]);
      }
    }
    if (factors.length > 0) {
      const [fa, fb] = factors[randInt(0, factors.length - 1)];
      expr = `${fa}*${fb}`;
      display = `${fa}×${fb}`;
    } else {
      // fallback to addition
      a = randInt(0, answer);
      b = answer - a;
      expr = `${a}+${b}`;
      display = `${a}+${b}`;
    }
  }
  return { expression: expr, display, answer };
}

function buildContiguousGroup(pieceCells, rows, cols, size) {
  // BFS from a random piece cell to build a contiguous group
  const available = new Set(pieceCells);
  const start = [...available][randInt(0, available.size - 1)];
  const group = [start];
  const groupSet = new Set([start]);
  const frontier = [];

  for (const adj of getAdjacentCells(start, rows, cols)) {
    if (available.has(adj) && !groupSet.has(adj)) frontier.push(adj);
  }
  shuffle(frontier);

  while (group.length < size && frontier.length > 0) {
    const next = frontier.shift();
    if (groupSet.has(next)) continue;
    if (!available.has(next)) continue;
    group.push(next);
    groupSet.add(next);
    for (const adj of getAdjacentCells(next, rows, cols)) {
      if (available.has(adj) && !groupSet.has(adj)) frontier.push(adj);
    }
    shuffle(frontier);
  }
  return group;
}

/**
 * Generate a single random puzzle.
 * @param {string} difficulty - difficulty key
 * @param {number} puzzleId - puzzle ID
 * @returns {object|null} puzzle data in export JSON format, or null on failure
 */
export function generatePuzzle(difficulty, puzzleId) {
  const limits = DIFFICULTY_LIMITS[difficulty];
  const grid = DIFFICULTY_GRIDS[difficulty];
  if (!limits || !grid) return null;

  const [minP, maxP, minC, maxC, minM, maxM] = limits;
  const [rows, cols] = grid;

  for (let attempt = 0; attempt < 50; attempt++) {
    const result = tryGenerate(difficulty, puzzleId, rows, cols, minP, maxP, minC, maxC, minM, maxM);
    if (result) return result;
  }
  return null;
}

function tryGenerate(difficulty, puzzleId, rows, cols, minP, maxP, minC, maxC, minM, maxM) {
  const numPieces = randInt(minP, maxP);
  // Cap monsters: at most half the pieces (rounded down), and leave at least 2 grid pieces
  const monsterCap = Math.min(maxM, Math.floor(numPieces / 2), numPieces - 2);
  const numMonsters = monsterCap > minM ? randInt(minM, monsterCap) : minM;
  const gridPieces = numPieces - numMonsters;
  const numConditions = randInt(minC, maxC);

  // All cells
  const allCells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      allCells.push(cellName(c, r));

  // Place monsters on random cells
  const shuffledCells = shuffle([...allCells]);
  const monsterCellNames = shuffledCells.slice(0, numMonsters);
  const monsterSet = new Set(monsterCellNames);

  // Available cells for domino placement (not monster)
  const availableCells = allCells.filter(c => !monsterSet.has(c));

  // Find all adjacent pairs among available cells
  const pairs = [];
  for (const cell of availableCells) {
    const [col, row] = parseCell(cell);
    // Only check right and down to avoid duplicates
    if (col + 1 < cols) {
      const right = cellName(col + 1, row);
      if (!monsterSet.has(right)) pairs.push([cell, right]);
    }
    if (row + 1 < rows) {
      const down = cellName(col, row + 1);
      if (!monsterSet.has(down)) pairs.push([cell, down]);
    }
  }

  // Greedy tiling
  shuffle(pairs);
  const usedCells = new Set();
  const placements = []; // [{cell1, cell2}]

  for (const [c1, c2] of pairs) {
    if (placements.length >= gridPieces) break;
    if (usedCells.has(c1) || usedCells.has(c2)) continue;
    placements.push({ cell1: c1, cell2: c2 });
    usedCells.add(c1);
    usedCells.add(c2);
  }

  if (placements.length < gridPieces) return null; // couldn't place enough

  // Blocked cells = available cells not used by pieces
  const blockedCells = availableCells.filter(c => !usedCells.has(c));

  // Assign random values to each piece half
  const pieces = [];
  const solution = [];
  const cellValues = {};

  for (let i = 0; i < placements.length; i++) {
    const id = i + 1;
    const left = randInt(1, 12);
    const right = randInt(1, 12);
    pieces.push({ id, left, right });

    const { cell1, cell2 } = placements[i];
    cellValues[cell1] = left;
    cellValues[cell2] = right;

    const rot = computeRotation(cell1, cell2, left, right, left, right);
    solution.push({ piece: id, cells: [cell1, cell2], rotation: rot });
  }

  // Track all piece sums for ambiguity avoidance
  const pieceSums = new Set();
  for (const p of pieces) pieceSums.add(p.left + p.right);

  // Generate monster data + sacrifice pieces
  const monsterCells = [];
  const monsterSolution = [];

  for (let i = 0; i < numMonsters; i++) {
    // Pick answer not in pieceSums (and not already used by another monster)
    let answer = -1;
    const tried = new Set();
    for (let t = 0; t < 100; t++) {
      const candidate = randInt(2, 24);
      if (!pieceSums.has(candidate) && !tried.has(candidate)) {
        answer = candidate;
        break;
      }
      tried.add(candidate);
    }
    if (answer < 0) return null; // couldn't find non-ambiguous answer

    pieceSums.add(answer); // prevent future pieces/monsters from reusing

    const { expression, display } = generateExpression(answer);
    monsterCells.push({
      cell: monsterCellNames[i],
      expression,
      display: display || '',
      answer
    });

    // Sacrifice piece
    const sacId = pieces.length + 1;
    const sacLeft = randInt(1, Math.min(answer - 1, 12));
    const sacRight = answer - sacLeft;
    if (sacRight < 1 || sacRight > 12) return null;

    pieces.push({ id: sacId, left: sacLeft, right: sacRight });
    monsterSolution.push({ monster_cell: monsterCellNames[i], piece: sacId });
  }

  // Generate conditions from actual cell values (piece cells only)
  const pieceCellList = [...usedCells]; // cells with pieces on them
  const conditions = [];
  const usedCondCells = new Set(); // track to avoid too much overlap

  for (let ci = 0; ci < numConditions; ci++) {
    const groupSize = randInt(1, Math.min(4, pieceCellList.length));
    const group = buildContiguousGroup(pieceCellList, rows, cols, groupSize);

    if (group.length < 1) continue;

    const values = group.map(c => cellValues[c] ?? 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const allEqual = new Set(values).size === 1;

    // Pick operator
    const ops = ['sum'];
    if (group.length >= 2 && allEqual) ops.push('=');
    if (sum > 0) { ops.push('>'); ops.push('>='); }
    ops.push('<'); ops.push('<=');

    const op = ops[randInt(0, ops.length - 1)];
    let value = 0;

    if (op === 'sum') {
      value = sum;
    } else if (op === '=') {
      value = 0; // = operator ignores value
    } else if (op === '>') {
      value = randInt(0, Math.max(0, sum - 1));
    } else if (op === '>=') {
      value = sum;
    } else if (op === '<') {
      value = sum + randInt(1, 5);
    } else if (op === '<=') {
      value = sum;
    }

    conditions.push({ cells: group, operator: op, value });
  }

  if (conditions.length < numConditions) return null;

  // Build the export JSON
  const data = {
    id: puzzleId,
    difficulty,
    grid_cols: cols,
    grid_rows: rows,
    lives: 3,
    blocked_cells: blockedCells.sort(),
    monster_cells: monsterCells,
    pieces: pieces.map(p => ({ id: p.id, left: p.left, right: p.right })),
    conditions,
    solution,
    monster_solution: monsterSolution
  };

  // Validate using the existing system by building a temporary model
  const tmpModel = buildModelFromData(data);
  const { errors } = validate(tmpModel);
  if (errors.length > 0) return null;

  const proof = prove(tmpModel);
  if (!proof.pass) return null;

  return data;
}

function buildModelFromData(data) {
  // Build a minimal model object for validate/prove
  const pieceMap = {};
  for (const p of data.pieces) pieceMap[p.id] = p;

  const m = {
    difficulty: data.difficulty,
    gridRows: data.grid_rows,
    gridCols: data.grid_cols,
    puzzleId: data.id,
    blockedCells: new Set(data.blocked_cells || []),
    pieces: data.pieces,
    solution: (data.solution || []).map(s => {
      const piece = pieceMap[s.piece];
      let v1 = 0, v2 = 0;
      if (piece) {
        const rot = s.rotation || 0;
        if (rot === 0 || rot === 1) { v1 = piece.left; v2 = piece.right; }
        else { v1 = piece.right; v2 = piece.left; }
      }
      return { pieceId: s.piece, cell1: s.cells[0], cell2: s.cells[1], val1: v1, val2: v2 };
    }),
    conditions: (data.conditions || []).map(c => ({
      cells: (c.cells || []).join(', '),
      operator: c.operator,
      value: c.value
    })),
    monsterCells: (data.monster_cells || []).map(mc => ({
      cell: mc.cell, expression: mc.expression, display: mc.display || '', answer: mc.answer
    })),
    monsterSolution: (data.monster_solution || []).map(ms => ({
      monsterCell: ms.monster_cell, pieceId: ms.piece
    })),
    selectedConditionIndex: null,
    allCellNames() {
      const s = new Set();
      for (let r = 0; r < this.gridRows; r++)
        for (let c = 0; c < this.gridCols; c++)
          s.add(String.fromCharCode(65 + r) + (c + 1));
      return s;
    },
    getMonsterCellNames() {
      return new Set(this.monsterCells.map(mc => mc.cell).filter(Boolean));
    },
    getPieceIds() {
      return this.pieces.map(p => p.id);
    }
  };
  return m;
}

/**
 * Generate a batch of puzzles.
 * @param {object} config - { totalLevels, startId, counts: {difficulty: number}, pins: [{levelNum, difficulty}] }
 * @param {function} onProgress - callback(current, total)
 * @returns {Promise<Array>} array of {id, filename, data} objects
 */
export async function generateBatch(config, onProgress) {
  const { totalLevels, startId, counts, pins } = config;

  // Build difficulty assignment array
  const assignments = new Array(totalLevels).fill(null);

  // Place pins first
  const remainingCounts = { ...counts };
  for (const pin of (pins || [])) {
    const idx = pin.levelNum - 1; // 0-indexed
    if (idx >= 0 && idx < totalLevels) {
      assignments[idx] = pin.difficulty;
      if (remainingCounts[pin.difficulty] > 0) remainingCounts[pin.difficulty]--;
    }
  }

  // Build pool from remaining counts
  const pool = [];
  for (const [diff, count] of Object.entries(remainingCounts)) {
    for (let i = 0; i < count; i++) pool.push(diff);
  }
  shuffle(pool);

  // Fill unpinned slots
  let poolIdx = 0;
  for (let i = 0; i < totalLevels; i++) {
    if (!assignments[i]) {
      assignments[i] = pool[poolIdx++] || 'facil';
    }
  }

  // Generate puzzles
  const results = [];
  for (let i = 0; i < totalLevels; i++) {
    const id = startId + i;
    const difficulty = assignments[i];
    const data = generatePuzzle(difficulty, id);

    if (data) {
      const filename = `level_${String(id).padStart(2, '0')}.json`;
      results.push({ id, filename, data });
    } else {
      results.push({ id, filename: `level_${String(id).padStart(2, '0')}.json`, data: null, error: `Failed to generate level ${id} (${difficulty})` });
    }

    if (onProgress) onProgress(i + 1, totalLevels);

    // Yield to UI every 5 puzzles
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  return results;
}

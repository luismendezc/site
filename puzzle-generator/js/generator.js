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

/**
 * Generate a math expression that evaluates to answer.
 * @param {number} answer - target value
 * @param {string} difficulty - difficulty key (determines allowed operations)
 *   Easy (extra_facil, facil): +, − only, 2 operands
 *   Medium (medio_bajo, medio_alto): +, −, ×, /, 2-3 operands
 *   Hard (dificil_bajo, dificil_alto): all ops + ^, √, 2-3 operands, must include ^ or √
 */
function generateExpression(answer, difficulty) {
  const tier = getDifficultyTier(difficulty);

  if (tier === 'hard') return generateHardExpression(answer);
  if (tier === 'medium') return generateMediumExpression(answer);
  return generateEasyExpression(answer);
}

function getDifficultyTier(difficulty) {
  if (difficulty === 'dificil_bajo' || difficulty === 'dificil_alto') return 'hard';
  if (difficulty === 'medio_bajo' || difficulty === 'medio_alto') return 'medium';
  return 'easy';
}

// --- Easy: + and − only, 2 operands ---
function generateEasyExpression(answer) {
  const op = randInt(0, 1) === 0 ? '+' : '-';
  if (op === '+') {
    const a = randInt(1, Math.max(answer - 1, 1));
    const b = answer - a;
    return { expression: `${a}+${b}`, display: `${a}+${b}`, answer };
  }
  // subtraction: a - b = answer, b in 1..12, a <= 24
  const b = randInt(1, 12);
  const a = answer + b;
  if (a > 24) {
    // fallback to addition
    const x = randInt(1, Math.max(answer - 1, 1));
    const y = answer - x;
    return { expression: `${x}+${y}`, display: `${x}+${y}`, answer };
  }
  return { expression: `${a}-${b}`, display: `${a}−${b}`, answer };
}

// --- Medium: +, −, ×, /, 2-3 operands ---
function generateMediumExpression(answer) {
  // Try multi-step first (50% chance), fall back to 2-operand
  if (randInt(0, 1) === 0) {
    const multi = tryMediumMultiStep(answer);
    if (multi) return multi;
  }
  return generateMediumTwoOp(answer);
}

function generateMediumTwoOp(answer) {
  const ops = ['+', '-', '*', '/'];
  shuffle(ops);
  for (const op of ops) {
    const result = tryTwoOp(answer, op);
    if (result) return result;
  }
  // ultimate fallback
  return generateEasyExpression(answer);
}

function tryTwoOp(answer, op) {
  if (op === '+') {
    const a = randInt(1, Math.max(answer - 1, 1));
    const b = answer - a;
    return { expression: `${a}+${b}`, display: `${a}+${b}`, answer };
  }
  if (op === '-') {
    const b = randInt(1, 12);
    const a = answer + b;
    if (a > 24) return null;
    return { expression: `${a}-${b}`, display: `${a}−${b}`, answer };
  }
  if (op === '*') {
    const factors = [];
    for (let i = 2; i <= 12; i++) {
      if (answer % i === 0 && answer / i >= 2 && answer / i <= 12) {
        factors.push([i, answer / i]);
      }
    }
    if (factors.length === 0) return null;
    const [a, b] = factors[randInt(0, factors.length - 1)];
    return { expression: `${a}*${b}`, display: `${a}×${b}`, answer };
  }
  if (op === '/') {
    // a / b = answer → a = answer * b, both in reasonable range
    const divisors = [];
    for (let b = 2; b <= 12; b++) {
      const a = answer * b;
      if (a <= 144 && a >= 2) divisors.push([a, b]);
    }
    if (divisors.length === 0) return null;
    const [a, b] = divisors[randInt(0, divisors.length - 1)];
    return { expression: `${a}/${b}`, display: `${a}/${b}`, answer };
  }
  return null;
}

function tryMediumMultiStep(answer) {
  // Try patterns: (a ○ b) □ c = answer
  // Pattern 1: (a * b) + c  or  (a * b) - c
  for (let t = 0; t < 10; t++) {
    const c = randInt(1, 8);
    const inner = randInt(0, 1) === 0 ? answer - c : answer + c;
    const outerOp = inner === answer - c ? '+' : '-';
    if (inner < 2) continue;
    // Try to factor inner as multiplication
    const factors = [];
    for (let i = 2; i <= 12; i++) {
      if (inner % i === 0 && inner / i >= 2 && inner / i <= 12) {
        factors.push([i, inner / i]);
      }
    }
    if (factors.length > 0) {
      const [a, b] = factors[randInt(0, factors.length - 1)];
      const outerDisp = outerOp === '+' ? '+' : '−';
      return {
        expression: `(${a}*${b})${outerOp}${c}`,
        display: `(${a}×${b})${outerDisp}${c}`,
        answer
      };
    }
  }
  // Pattern 2: (a / b) + c  or  (a / b) - c
  for (let t = 0; t < 10; t++) {
    const c = randInt(1, 8);
    const inner = randInt(0, 1) === 0 ? answer - c : answer + c;
    const outerOp = inner === answer - c ? '+' : '-';
    if (inner < 1 || inner > 12) continue;
    // a / b = inner → a = inner * b
    const b = randInt(2, 9);
    const a = inner * b;
    if (a > 144 || a < 2) continue;
    const outerDisp = outerOp === '+' ? '+' : '−';
    return {
      expression: `(${a}/${b})${outerOp}${c}`,
      display: `(${a}/${b})${outerDisp}${c}`,
      answer
    };
  }
  return null;
}

// --- Hard: must include ^ or √, 2-3 operands ---
function generateHardExpression(answer) {
  // Try √ and ^ patterns, shuffled
  const strategies = shuffle([trySquareRoot, tryExponent]);
  for (const strategy of strategies) {
    const result = strategy(answer);
    if (result) return result;
  }
  // Fallback to medium if no ^ or √ pattern works
  return generateMediumExpression(answer);
}

function trySquareRoot(answer) {
  // Perfect squares we can use: 1,4,9,16,25,36,49,64,81,100,121,144
  const squares = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];
  const roots =   [1, 2, 3,  4,  5,  6,  7,  8,  9,  10,  11,  12];

  // Pattern: √n + c = answer  or  √n - c = answer  or  √n * c = answer
  const attempts = [];
  for (let i = 0; i < squares.length; i++) {
    const rootVal = roots[i];
    const sq = squares[i];
    // √sq + c = answer → c = answer - rootVal
    const cAdd = answer - rootVal;
    if (cAdd >= 0 && cAdd <= 24) {
      if (cAdd === 0) {
        attempts.push({ expression: `sqrt(${sq})`, display: `√${sq}`, answer });
      } else {
        attempts.push({ expression: `sqrt(${sq})+${cAdd}`, display: `√${sq}+${cAdd}`, answer });
      }
    }
    // √sq - c = answer → c = rootVal - answer
    const cSub = rootVal - answer;
    if (cSub > 0 && cSub <= 12) {
      attempts.push({ expression: `sqrt(${sq})-${cSub}`, display: `√${sq}−${cSub}`, answer });
    }
    // √sq * c = answer → c = answer / rootVal
    if (rootVal >= 2 && answer % rootVal === 0) {
      const cMul = answer / rootVal;
      if (cMul >= 2 && cMul <= 12) {
        attempts.push({ expression: `sqrt(${sq})*${cMul}`, display: `√${sq}×${cMul}`, answer });
      }
    }
  }
  if (attempts.length === 0) return null;
  return attempts[randInt(0, attempts.length - 1)];
}

function tryExponent(answer) {
  // Small bases and exponents: 2^2=4, 2^3=8, 2^4=16, 3^2=9, 3^3=27, 4^2=16, 5^2=25, etc.
  const powers = [
    { base: 2, exp: 2, val: 4 },
    { base: 2, exp: 3, val: 8 },
    { base: 2, exp: 4, val: 16 },
    { base: 3, exp: 2, val: 9 },
    { base: 3, exp: 3, val: 27 },
    { base: 4, exp: 2, val: 16 },
    { base: 5, exp: 2, val: 25 },
    { base: 6, exp: 2, val: 36 },
    { base: 7, exp: 2, val: 49 },
    { base: 8, exp: 2, val: 64 },
    { base: 9, exp: 2, val: 81 },
    { base: 10, exp: 2, val: 100 },
    { base: 11, exp: 2, val: 121 },
    { base: 12, exp: 2, val: 144 },
  ];

  const attempts = [];
  for (const p of powers) {
    // b^e + c = answer → c = answer - val
    const cAdd = answer - p.val;
    if (cAdd === 0) {
      attempts.push({ expression: `${p.base}^${p.exp}`, display: `${p.base}^${p.exp}`, answer });
    } else if (cAdd > 0 && cAdd <= 12) {
      attempts.push({ expression: `(${p.base}^${p.exp})+${cAdd}`, display: `(${p.base}^${p.exp})+${cAdd}`, answer });
    }
    // b^e - c = answer → c = val - answer
    const cSub = p.val - answer;
    if (cSub > 0 && cSub <= 12) {
      attempts.push({ expression: `(${p.base}^${p.exp})-${cSub}`, display: `(${p.base}^${p.exp})−${cSub}`, answer });
    }
    // b^e / c = answer → c = val / answer
    if (answer >= 2 && p.val % answer === 0) {
      const cDiv = p.val / answer;
      if (cDiv >= 2 && cDiv <= 12) {
        attempts.push({ expression: `(${p.base}^${p.exp})/${cDiv}`, display: `(${p.base}^${p.exp})/${cDiv}`, answer });
      }
    }
  }
  if (attempts.length === 0) return null;
  return attempts[randInt(0, attempts.length - 1)];
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

  // Split unused cells into blocked vs empty decoys
  const unusedCells = availableCells.filter(c => !usedCells.has(c));
  shuffle(unusedCells);
  // Keep 1-3 cells as empty decoys (random noise), scale with grid size
  const maxDecoys = Math.min(3, Math.floor(unusedCells.length * 0.4));
  const numDecoys = unusedCells.length > 0 ? randInt(0, maxDecoys) : 0;
  const decoyCells = new Set(unusedCells.slice(0, numDecoys));
  const blockedCells = unusedCells.filter(c => !decoyCells.has(c));

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

    const { expression, display } = generateExpression(answer, difficulty);
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

  // Generate conditions from piece cells + empty decoy cells
  // Decoy cells have value 0, adding noise so the player can't just
  // match open cells to piece slots
  const pieceCellList = [...usedCells, ...decoyCells];
  const conditions = [];
  const usedCondCells = new Set(); // cells already claimed by a condition

  for (let ci = 0; ci < numConditions; ci++) {
    const remainingCells = pieceCellList.filter(c => !usedCondCells.has(c));
    if (remainingCells.length < 1) break; // no more cells available

    const groupSize = randInt(1, Math.min(4, remainingCells.length));
    const group = buildContiguousGroup(remainingCells, rows, cols, groupSize);

    if (group.length < 1) continue;

    // Mark these cells as used by conditions
    for (const c of group) usedCondCells.add(c);

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

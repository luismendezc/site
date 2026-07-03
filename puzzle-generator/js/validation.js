// Validar + Probar — todo en español
// Límites de dificultad son advertencias, no errores bloqueantes
import { parseCell, parseCellList, areCellsAdjacent } from './cell-utils.js';
import { DIFFICULTY_LIMITS, DIFFICULTY_INFO } from './puzzle-model.js';

export function validate(model) {
  const errors = [];
  const warnings = [];
  const m = model;
  const allCells = m.allCellNames();
  const pieceMap = {};
  for (const p of m.pieces) pieceMap[p.id] = p;

  // Límites de dificultad → advertencias (no bloquean)
  const limits = DIFFICULTY_LIMITS[m.difficulty];
  if (limits) {
    const [minP, maxP, minC, maxC, minM, maxM] = limits;
    const name = DIFFICULTY_INFO[m.difficulty][0];
    if (m.pieces.length < minP) warnings.push(`Piezas insuficientes: ${m.pieces.length} (mínimo ${minP} para '${name}').`);
    else if (m.pieces.length > maxP) warnings.push(`Demasiadas piezas: ${m.pieces.length} (máximo ${maxP} para '${name}').`);
    if (m.conditions.length < minC) warnings.push(`Condiciones insuficientes: ${m.conditions.length} (mínimo ${minC} para '${name}').`);
    if (m.monsterCells.length < minM) warnings.push(`Monstruos insuficientes: ${m.monsterCells.length} (mínimo ${minM} para '${name}').`);
    else if (m.monsterCells.length > maxM) warnings.push(`Demasiados monstruos: ${m.monsterCells.length} (máximo ${maxM} para '${name}').`);
  }

  // Validación de celdas de monstruo
  const seenMonsters = new Set();
  for (let i = 0; i < m.monsterCells.length; i++) {
    const mon = m.monsterCells[i];
    const mc = mon.cell;
    if (!mc) { errors.push(`Monstruo ${i + 1}: el nombre de celda está vacío.`); continue; }
    try { parseCell(mc); } catch { errors.push(`Monstruo ${i + 1}: '${mc}' no es una celda válida.`); continue; }
    if (!allCells.has(mc)) { errors.push(`Monstruo ${i + 1}: la celda ${mc} está fuera de la cuadrícula.`); continue; }
    if (m.blockedCells.has(mc)) errors.push(`Monstruo ${i + 1}: la celda ${mc} ya está bloqueada.`);
    if (seenMonsters.has(mc)) errors.push(`Monstruo ${i + 1}: celda de monstruo duplicada ${mc}.`);
    seenMonsters.add(mc);
    if (!mon.expression) errors.push(`Monstruo ${i + 1}: la expresión está vacía.`);
  }

  // Verificación de solución
  const covered = new Set();
  const usedPieces = new Set();
  for (let i = 0; i < m.solution.length; i++) {
    const s = m.solution[i];
    const pid = s.pieceId;
    if (pid == null) { errors.push(`Solución ${i + 1}: ID de pieza inválido.`); continue; }
    if (!s.cell1 || !s.cell2) { errors.push(`Solución ${i + 1}: faltan celdas.`); continue; }
    if (usedPieces.has(pid)) errors.push(`Solución ${i + 1}: la pieza #${pid} ya fue usada.`);
    usedPieces.add(pid);

    for (const cn of [s.cell1, s.cell2]) {
      if (!allCells.has(cn)) errors.push(`Solución ${i + 1}: la celda ${cn} no está en la cuadrícula.`);
      if (m.blockedCells.has(cn)) errors.push(`Solución ${i + 1}: la celda ${cn} está bloqueada.`);
      if (seenMonsters.has(cn)) errors.push(`Solución ${i + 1}: la celda ${cn} es un monstruo — no se pueden colocar piezas ahí.`);
      if (covered.has(cn)) errors.push(`Solución ${i + 1}: la celda ${cn} ya fue usada.`);
      covered.add(cn);
    }

    if (allCells.has(s.cell1) && allCells.has(s.cell2) && !areCellsAdjacent(s.cell1, s.cell2)) {
      errors.push(`Solución ${i + 1}: ${s.cell1} y ${s.cell2} no son adyacentes.`);
    }

    if (pieceMap[pid]) {
      const pl = pieceMap[pid].left, pr = pieceMap[pid].right;
      const v1 = s.val1, v2 = s.val2;
      const match = (v1 === pl && v2 === pr) || (v1 === pr && v2 === pl);
      if (!match) errors.push(`Solución ${i + 1}: los valores (${v1},${v2}) no coinciden con la pieza #${pid} (${pl},${pr}).`);
    }
  }

  // Validación de solución de monstruo
  const msMonsters = new Set();
  const msPieces = new Set();
  const monsterAnswerMap = {};
  for (const mon of m.monsterCells) {
    if (mon.cell) monsterAnswerMap[mon.cell] = mon.answer;
  }

  for (let i = 0; i < m.monsterSolution.length; i++) {
    const ms = m.monsterSolution[i];
    const mc = ms.monsterCell;
    const pid = ms.pieceId;
    if (!seenMonsters.has(mc)) errors.push(`Solución monstruo ${i + 1}: '${mc}' no es una celda de monstruo definida.`);
    if (msMonsters.has(mc)) errors.push(`Solución monstruo ${i + 1}: celda de monstruo duplicada ${mc}.`);
    msMonsters.add(mc);
    if (!pieceMap[pid]) errors.push(`Solución monstruo ${i + 1}: la pieza #${pid} no existe.`);
    else if (monsterAnswerMap[mc] !== undefined) {
      const pl = pieceMap[pid].left, pr = pieceMap[pid].right;
      if (pl + pr !== monsterAnswerMap[mc])
        errors.push(`Solución monstruo ${i + 1}: la pieza #${pid} (${pl}+${pr}=${pl + pr}) no coincide con la respuesta del monstruo ${mc} (${monsterAnswerMap[mc]}).`);
    }
    if (msPieces.has(pid)) errors.push(`Solución monstruo ${i + 1}: la pieza #${pid} ya se usa en otra solución de monstruo.`);
    msPieces.add(pid);
    if (usedPieces.has(pid)) errors.push(`Solución monstruo ${i + 1}: la pieza #${pid} también se usa en la solución de cuadrícula.`);
  }

  for (const mc of seenMonsters) {
    if (!msMonsters.has(mc)) errors.push(`El monstruo en ${mc} no tiene entrada en solución de monstruo.`);
  }

  for (const p of m.pieces) {
    if (!usedPieces.has(p.id) && !msPieces.has(p.id))
      errors.push(`La pieza #${p.id} no tiene entrada en solución ni en solución de monstruo.`);
  }

  // Verificación de ambigüedad de monstruo
  if (Object.keys(monsterAnswerMap).length > 0) {
    for (const [mc, ans] of Object.entries(monsterAnswerMap)) {
      const matching = m.pieces.filter(p => p.left + p.right === ans).map(p => p.id);
      const designated = new Set();
      for (const ms of m.monsterSolution) {
        if (ms.monsterCell === mc) designated.add(ms.pieceId);
      }
      const ambiguous = matching.filter(id => !designated.has(id));
      if (ambiguous.length > 0) {
        errors.push(`¡Ambigüedad en monstruo ${mc} (respuesta=${ans})! Las piezas ${ambiguous.map(id => '#' + id).join(', ')} también suman ${ans}. El jugador podría alimentar la pieza equivocada haciendo el puzzle irresoluble.`);
      }
    }
  }

  // Valores de piezas
  for (const p of m.pieces) {
    if (p.left < 0 || p.left > 12 || p.right < 0 || p.right > 12)
      errors.push(`Pieza #${p.id}: los valores deben ser 0-12.`);
  }

  // Condiciones
  for (let i = 0; i < m.conditions.length; i++) {
    const cond = m.conditions[i];
    const cells = parseCellList(cond.cells);
    if (!cells.length) errors.push(`Condición ${i + 1}: se requiere al menos una celda.`);
    if (cond.operator === '=' && cells.length < 2) errors.push(`Condición ${i + 1}: el operador '=' necesita al menos 2 celdas.`);
    if (cond.operator === 'sum' && cells.length < 2) errors.push(`Condición ${i + 1}: el operador 'sum' necesita al menos 2 celdas.`);
    for (const cn of cells) {
      if (cn && !allCells.has(cn)) errors.push(`Condición ${i + 1}: la celda ${cn} no está en la cuadrícula.`);
      else if (cn && m.blockedCells.has(cn)) errors.push(`Condición ${i + 1}: la celda ${cn} está bloqueada.`);
    }
    // Advertencia: celdas de condición que se superponen con monstruos
    for (const cn of cells) {
      if (seenMonsters.has(cn)) {
        errors.push(`Condición ${i + 1}: la celda ${cn} es un monstruo. Los monstruos se consumen al ser derrotados, así que las condiciones sobre ellos nunca se pueden satisfacer.`);
      }
    }
  }

  return { errors, warnings };
}

function cmp(a, op, b) {
  if (op === '>') return a > b;
  if (op === '<') return a < b;
  if (op === '>=') return a >= b;
  if (op === '<=') return a <= b;
  return false;
}

export function prove(model) {
  const { errors, warnings } = validate(model);
  if (errors.length > 0) return { pass: false, errors, warnings, results: [] };

  const m = model;
  const cellValues = {};
  for (const s of m.solution) {
    if (s.cell1) cellValues[s.cell1] = s.val1;
    if (s.cell2) cellValues[s.cell2] = s.val2;
  }

  const results = [];
  let allPass = true;
  const pieceMap = {};
  for (const p of m.pieces) pieceMap[p.id] = p;

  // Probar monstruos
  if (m.monsterCells.length > 0) {
    results.push(`── Solución de Monstruos (${m.monsterCells.length} monstruo(s)) ──`);
    const monsterAnswerMap = {};
    for (const mon of m.monsterCells) if (mon.cell) monsterAnswerMap[mon.cell] = mon.answer;
    for (const ms of m.monsterSolution) {
      const piece = pieceMap[ms.pieceId];
      const ans = monsterAnswerMap[ms.monsterCell];
      if (piece && ans !== undefined) {
        const s = piece.left + piece.right;
        if (s === ans) results.push(`  Monstruo ${ms.monsterCell} (respuesta=${ans}): pieza #${ms.pieceId} (${piece.left}+${piece.right}=${s}) ✓`);
        else { results.push(`  Monstruo ${ms.monsterCell} (respuesta=${ans}): pieza #${ms.pieceId} (${piece.left}+${piece.right}=${s}) ✗`); allPass = false; }
      }
    }
    results.push('');
  }

  results.push('── Condiciones ──');
  for (let i = 0; i < m.conditions.length; i++) {
    const cond = m.conditions[i];
    const cells = parseCellList(cond.cells);
    const values = cells.map(c => cellValues[c] ?? 0);
    const missing = cells.filter(c => !(c in cellValues));
    const note = missing.length ? ` (celdas ${missing.join(', ')} = 0)` : '';
    const op = cond.operator;
    const val = cond.value;

    if (op === '=') {
      if (new Set(values).size === 1) results.push(`#${i + 1}: PASA — todas las celdas = ${values[0]}${note}`);
      else { results.push(`#${i + 1}: FALLA — los valores [${values}] no son todos iguales${note}`); allPass = false; }
    } else if (op === 'sum') {
      const s = values.reduce((a, b) => a + b, 0);
      if (s === val) results.push(`#${i + 1}: PASA — suma ${s} = ${val}${note}`);
      else { results.push(`#${i + 1}: FALLA — suma ${s} != ${val}${note}`); allPass = false; }
    } else {
      const s = cells.length > 1 ? values.reduce((a, b) => a + b, 0) : values[0];
      const label = cells.length > 1 ? `suma=${s}` : `val=${s}`;
      if (cmp(s, op, val)) results.push(`#${i + 1}: PASA — ${label} ${op} ${val}${note}`);
      else { results.push(`#${i + 1}: FALLA — ${label} ${op} ${val} es falso${note}`); allPass = false; }
    }
  }

  return { pass: allPass, errors: [], warnings, results };
}

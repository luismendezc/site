// Entry point — wiring, import/export — todo en español
import { PuzzleModel, DIFFICULTY_GRIDS, DIFFICULTY_INFO } from './puzzle-model.js';
import { GridRenderer } from './grid.js';
import { TabsUI } from './tabs.js';
import { validate, prove } from './validation.js';
import { computeRotation, parseCellList } from './cell-utils.js';
import { generatePuzzle, generateBatch } from './generator.js';
import { PuzzlePlayer } from './player.js';

const model = new PuzzleModel();

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('grid-canvas');
  const grid = new GridRenderer(canvas, model);
  const tabs = new TabsUI(model);

  grid.setMonsterDialogCallback(cell => openMonsterModal(cell));

  // Dificultad
  const diffSel = document.getElementById('difficulty-select');
  const gridLabel = document.getElementById('grid-label');
  const diffInfo = document.getElementById('diff-info');
  diffSel.addEventListener('change', () => {
    model.setDifficulty(diffSel.value);
    updateDiffUI();
  });
  function updateDiffUI() {
    const g = DIFFICULTY_GRIDS[model.difficulty];
    gridLabel.textContent = `${g[0]} filas × ${g[1]} columnas`;
    const info = DIFFICULTY_INFO[model.difficulty];
    diffInfo.textContent = `${info[0]} — ${info[1]}`;
  }
  updateDiffUI();

  // ID del puzzle
  document.getElementById('puzzle-id').addEventListener('change', e => {
    model.puzzleId = parseInt(e.target.value) || 1;
  });

  // Agregar — sin bloqueo por límites (se valida al final)
  document.getElementById('btn-add-piece').addEventListener('click', () => {
    model.pieces.push({ id: model.nextPieceId(), left: 0, right: 0 });
    model.changed();
  });

  document.getElementById('btn-add-solution').addEventListener('click', () => {
    const cells = model.getAvailableCells();
    const ids = model.getPieceIds();
    if (!ids.length) { showResult('Agrega piezas primero.', 'warning'); return; }
    model.solution.push({
      pieceId: ids[0], cell1: cells[0] || '', cell2: cells[1] || '',
      val1: 0, val2: 0
    });
    model.changed();
  });

  document.getElementById('btn-add-condition').addEventListener('click', () => {
    model.conditions.push({ cells: '', operator: '>', value: 0 });
    model.changed();
  });

  document.getElementById('btn-add-monster').addEventListener('click', () => {
    model.monsterCells.push({ cell: '', expression: '', display: '', answer: 0 });
    model.changed();
  });

  document.getElementById('btn-add-monster-sol').addEventListener('click', () => {
    const monsterNames = model.monsterCells.map(mc => mc.cell).filter(Boolean);
    const ids = model.getPieceIds();
    if (!monsterNames.length) { showResult('Agrega monstruos primero.', 'warning'); return; }
    if (!ids.length) { showResult('Agrega piezas primero.', 'warning'); return; }
    model.monsterSolution.push({ monsterCell: monsterNames[0], pieceId: ids[0] });
    model.changed();
  });

  // Validar / Probar
  document.getElementById('btn-validate').addEventListener('click', () => {
    const { errors, warnings } = validate(model);
    if (errors.length === 0 && warnings.length === 0) {
      showResult('✓ ¡Válido! Todas las reglas se cumplen.', 'success');
    } else {
      let msg = '';
      if (warnings.length > 0) {
        msg += '⚠ Advertencias de dificultad:\n' + warnings.map(w => '  ⚠ ' + w).join('\n') + '\n\n';
      }
      if (errors.length > 0) {
        msg += '✗ Errores de validación:\n' + errors.map(e => '  ✗ ' + e).join('\n');
      }
      showResult(msg.trim(), errors.length > 0 ? 'danger' : 'warning');
    }
  });

  const btnPlay = document.getElementById('btn-play');
  let currentPlayer = null;

  document.getElementById('btn-prove').addEventListener('click', () => {
    const { pass, errors, warnings, results } = prove(model);
    if (errors.length > 0) {
      let msg = '';
      if (warnings.length > 0) {
        msg += '⚠ Advertencias de dificultad:\n' + warnings.map(w => '  ⚠ ' + w).join('\n') + '\n\n';
      }
      msg += '✗ Validación fallida:\n' + errors.map(e => '  ✗ ' + e).join('\n');
      showResult(msg.trim(), 'danger');
      btnPlay.classList.add('d-none');
    } else if (pass) {
      let msg = '✓ ¡Todas las condiciones pasan!\n\n' + results.join('\n');
      if (warnings.length > 0) {
        msg += '\n\n⚠ Advertencias de dificultad:\n' + warnings.map(w => '  ⚠ ' + w).join('\n');
      }
      showResult(msg, warnings.length > 0 ? 'warning' : 'success');
      btnPlay.classList.remove('d-none');
    } else {
      showResult('✗ Algunas condiciones fallaron:\n\n' + results.join('\n'), 'danger');
      btnPlay.classList.add('d-none');
    }
  });

  // Play button — opens play modal
  btnPlay.addEventListener('click', () => {
    const pieceMap = {};
    for (const p of model.pieces) pieceMap[p.id] = p;

    const puzzleData = {
      id: model.puzzleId,
      difficulty: model.difficulty,
      grid_cols: model.gridCols,
      grid_rows: model.gridRows,
      lives: 3,
      blocked_cells: [...model.blockedCells].sort(),
      monster_cells: model.monsterCells.filter(m => m.cell).map(m => ({
        cell: m.cell, expression: m.expression, display: m.display || '', answer: m.answer
      })),
      pieces: model.pieces.map(p => ({ id: p.id, left: p.left, right: p.right })),
      conditions: model.conditions.map(c => ({
        cells: parseCellList(c.cells),
        operator: c.operator,
        value: c.operator === '=' ? 0 : c.value
      })),
      solution: model.solution.map(s => {
        const piece = pieceMap[s.pieceId];
        const rot = piece ? computeRotation(s.cell1, s.cell2, s.val1, s.val2, piece.left, piece.right) : 0;
        return { piece: s.pieceId, cells: [s.cell1, s.cell2], rotation: rot };
      }),
      monster_solution: model.monsterSolution.filter(ms => ms.monsterCell).map(ms => ({
        monster_cell: ms.monsterCell, piece: ms.pieceId
      }))
    };

    if (currentPlayer) currentPlayer.destroy();

    const modalEl = document.getElementById('play-modal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    // Wait for modal to be visible before initializing player
    modalEl.addEventListener('shown.bs.modal', function onShown() {
      modalEl.removeEventListener('shown.bs.modal', onShown);
      currentPlayer = new PuzzlePlayer(modalEl, puzzleData);
    });

    modalEl.addEventListener('hidden.bs.modal', function onHidden() {
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
      if (currentPlayer) { currentPlayer.destroy(); currentPlayer = null; }
    });
  });

  // Exportar
  document.getElementById('btn-export').addEventListener('click', () => {
    const pieceMap = {};
    for (const p of model.pieces) pieceMap[p.id] = p;

    const data = {
      id: model.puzzleId,
      difficulty: model.difficulty,
      grid_cols: model.gridCols,
      grid_rows: model.gridRows,
      lives: 3,
      blocked_cells: [...model.blockedCells].sort(),
      monster_cells: model.monsterCells.filter(m => m.cell).map(m => ({
        cell: m.cell, expression: m.expression, display: m.display || '', answer: m.answer
      })),
      pieces: model.pieces.map(p => ({ id: p.id, left: p.left, right: p.right })),
      conditions: model.conditions.map(c => ({
        cells: parseCellList(c.cells),
        operator: c.operator,
        value: c.operator === '=' ? 0 : c.value
      })),
      solution: model.solution.map(s => {
        const piece = pieceMap[s.pieceId];
        const rot = piece ? computeRotation(s.cell1, s.cell2, s.val1, s.val2, piece.left, piece.right) : 0;
        return { piece: s.pieceId, cells: [s.cell1, s.cell2], rotation: rot };
      }),
      monster_solution: model.monsterSolution.filter(ms => ms.monsterCell).map(ms => ({
        monster_cell: ms.monsterCell, piece: ms.pieceId
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `level_${String(model.puzzleId).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showResult('¡Exportado exitosamente!', 'success');
  });

  // Importar
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        loadFromJSON(JSON.parse(ev.target.result));
        showResult(`Puzzle #${model.puzzleId} cargado correctamente.`, 'success');
      } catch (err) {
        showResult('Error al importar: ' + err.message, 'danger');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Randomize
  document.getElementById('btn-randomize').addEventListener('click', () => {
    const diff = diffSel.value;
    const id = model.puzzleId;
    const data = generatePuzzle(diff, id);
    if (data) {
      loadFromJSON(data);
      showResult(`Puzzle #${id} generado aleatoriamente (${diff}).`, 'success');
    } else {
      showResult('No se pudo generar un puzzle válido. Intenta de nuevo.', 'danger');
    }
  });

  // Batch Randomize
  document.getElementById('btn-batch').addEventListener('click', () => {
    new bootstrap.Modal(document.getElementById('batch-modal')).show();
  });

  document.getElementById('btn-add-pin').addEventListener('click', () => {
    const div = document.createElement('div');
    div.className = 'd-flex gap-2 mb-1 batch-pin-row';
    div.innerHTML = `
      <input type="number" class="form-control form-control-sm pin-level" placeholder="Level #" min="1" style="width:80px">
      <select class="form-select form-select-sm pin-diff" style="width:130px">
        <option value="extra_facil">Extra Fácil</option>
        <option value="facil">Fácil</option>
        <option value="medio_bajo">Medio Bajo</option>
        <option value="medio_alto">Medio Alto</option>
        <option value="dificil_bajo">Difícil Bajo</option>
        <option value="dificil_alto">Difícil Alto</option>
      </select>
      <button class="btn btn-sm btn-outline-danger pin-remove">×</button>`;
    div.querySelector('.pin-remove').addEventListener('click', () => div.remove());
    document.getElementById('batch-pins').appendChild(div);
  });

  document.getElementById('batch-generate').addEventListener('click', async () => {
    const total = parseInt(document.getElementById('batch-total').value) || 25;
    const startId = parseInt(document.getElementById('batch-start-id').value) || 1;

    const counts = {};
    for (const input of document.querySelectorAll('.batch-count')) {
      counts[input.dataset.diff] = parseInt(input.value) || 0;
    }
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    const warn = document.getElementById('batch-sum-warn');
    if (sum !== total) {
      warn.textContent = `(suma ${sum} ≠ ${total})`;
      warn.classList.remove('d-none');
      return;
    }
    warn.classList.add('d-none');

    const pins = [];
    for (const row of document.querySelectorAll('.batch-pin-row')) {
      const levelNum = parseInt(row.querySelector('.pin-level').value);
      const difficulty = row.querySelector('.pin-diff').value;
      if (levelNum) pins.push({ levelNum, difficulty });
    }

    const progressWrap = document.getElementById('batch-progress-wrap');
    const progressBar = document.getElementById('batch-progress');
    progressWrap.classList.remove('d-none');
    progressBar.style.width = '0%';
    progressBar.textContent = '0%';

    const results = await generateBatch({ totalLevels: total, startId, counts, pins }, (cur, tot) => {
      const pct = Math.round((cur / tot) * 100);
      progressBar.style.width = pct + '%';
      progressBar.textContent = `${cur}/${tot}`;
    });

    const failed = results.filter(r => !r.data);
    if (failed.length > 0) {
      progressBar.textContent = `${results.length - failed.length}/${total} OK, ${failed.length} failed`;
    }

    // Package as ZIP
    const zip = new JSZip();
    const levelsFolder = zip.folder('levels');
    for (const r of results) {
      if (r.data) levelsFolder.file(r.filename, JSON.stringify(r.data, null, 2));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `puzzles_batch_${startId}_to_${startId + total - 1}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);

    progressBar.classList.remove('progress-bar-animated');
    progressBar.textContent = 'Done!';
    setTimeout(() => {
      progressWrap.classList.add('d-none');
      progressBar.classList.add('progress-bar-animated');
    }, 2000);
  });

  // Render inicial
  model.changed();
});

function loadFromJSON(data) {
  model.puzzleId = data.id || 1;
  model.difficulty = data.difficulty || 'facil';
  model.gridCols = data.grid_cols || 4;
  model.gridRows = data.grid_rows || 4;
  model.blockedCells = new Set(data.blocked_cells || []);
  model.pieces = (data.pieces || []).map(p => ({ id: p.id, left: p.left, right: p.right }));

  const pieceMap = {};
  for (const p of model.pieces) pieceMap[p.id] = p;

  model.solution = (data.solution || []).map(s => {
    const piece = pieceMap[s.piece];
    let v1 = 0, v2 = 0;
    if (piece) {
      const rot = s.rotation || 0;
      if (rot === 0 || rot === 1) { v1 = piece.left; v2 = piece.right; }
      else { v1 = piece.right; v2 = piece.left; }
    }
    return { pieceId: s.piece, cell1: s.cells[0], cell2: s.cells[1], val1: v1, val2: v2 };
  });

  model.conditions = (data.conditions || []).map(c => ({
    cells: (c.cells || []).join(', '),
    operator: c.operator || '>',
    value: c.value || 0
  }));

  model.monsterCells = (data.monster_cells || []).map(m => ({
    cell: m.cell || '', expression: m.expression || '', display: m.display || '', answer: m.answer || 0
  }));

  model.monsterSolution = (data.monster_solution || []).map(ms => ({
    monsterCell: ms.monster_cell || '', pieceId: ms.piece || 0
  }));

  model.selectedConditionIndex = null;

  document.getElementById('difficulty-select').value = model.difficulty;
  document.getElementById('puzzle-id').value = model.puzzleId;
  const g = DIFFICULTY_GRIDS[model.difficulty];
  if (g) document.getElementById('grid-label').textContent = `${g[0]} filas × ${g[1]} columnas`;

  model.changed();
}

function openMonsterModal(cell) {
  const existing = model.monsterCells.find(m => m.cell === cell);
  const modal = new bootstrap.Modal(document.getElementById('monster-modal'));
  document.getElementById('monster-modal-title').textContent = `Monstruo en ${cell}`;
  document.getElementById('monster-expr').value = existing ? existing.expression : '';
  document.getElementById('monster-display').value = existing ? (existing.display || '') : '';
  document.getElementById('monster-answer').value = existing ? existing.answer : 0;

  const saveBtn = document.getElementById('monster-save');
  const removeBtn = document.getElementById('monster-remove');
  removeBtn.classList.toggle('d-none', !existing);

  const newSave = saveBtn.cloneNode(true);
  saveBtn.replaceWith(newSave);
  const newRemove = removeBtn.cloneNode(true);
  removeBtn.replaceWith(newRemove);

  newSave.addEventListener('click', () => {
    const expr = document.getElementById('monster-expr').value;
    const display = document.getElementById('monster-display').value;
    const answer = parseInt(document.getElementById('monster-answer').value) || 0;
    if (existing) {
      existing.expression = expr; existing.display = display; existing.answer = answer;
    } else {
      model.monsterCells.push({ cell, expression: expr, display, answer });
    }
    model.changed();
    modal.hide();
  });
  newRemove.addEventListener('click', () => {
    model.monsterCells = model.monsterCells.filter(m => m.cell !== cell);
    model.changed();
    modal.hide();
  });

  modal.show();
}

function showResult(text, type) {
  const el = document.getElementById('results');
  el.className = `alert alert-${type} alert-results mt-2`;
  el.style.whiteSpace = 'pre-wrap';
  el.textContent = text;
  el.classList.remove('d-none');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

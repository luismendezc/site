// Tab UI builders — all Spanish, no blocking limits
import { parseCellList } from './cell-utils.js';

export class TabsUI {
  constructor(model) {
    this.model = model;
    model.on('change', () => this.rebuild());
    model.on('condition-cells-changed', () => this._syncConditionInputs());
  }

  rebuild() {
    this._buildPieces();
    this._buildSolution();
    this._buildConditions();
    this._buildMonsters();
  }

  // ── Piezas ─────────────────────────────────────────
  _buildPieces() {
    const el = document.getElementById('pieces-list');
    if (!el) return;
    const m = this.model;
    el.innerHTML = '';
    for (const p of m.pieces) {
      const row = document.createElement('div');
      row.className = 'entry-card d-flex align-items-center gap-2 flex-wrap';
      row.innerHTML = `
        <strong style="color:var(--accent-yellow)">#${p.id}</strong>
        <div class="input-group input-group-sm" style="width:auto">
          <span class="input-group-text">Izq</span>
          <input type="number" class="form-control" min="0" max="12" value="${p.left}" data-field="left" style="width:60px">
        </div>
        <div class="input-group input-group-sm" style="width:auto">
          <span class="input-group-text">Der</span>
          <input type="number" class="form-control" min="0" max="12" value="${p.right}" data-field="right" style="width:60px">
        </div>
        <button class="btn-remove" data-action="remove-piece" data-id="${p.id}">&times;</button>`;
      row.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('change', () => {
          p[inp.dataset.field] = parseInt(inp.value) || 0;
          m.changed();
        });
      });
      row.querySelector('[data-action="remove-piece"]').addEventListener('click', () => {
        m.pieces = m.pieces.filter(x => x.id !== p.id);
        m.changed();
      });
      el.appendChild(row);
    }
  }

  // ── Solución ───────────────────────────────────────
  _buildSolution() {
    const el = document.getElementById('solution-list');
    if (!el) return;
    const m = this.model;
    const cells = m.getAvailableCells();
    const pieceIds = m.getPieceIds();
    el.innerHTML = '';
    for (let i = 0; i < m.solution.length; i++) {
      const s = m.solution[i];
      const block = document.createElement('div');
      block.className = 'entry-card';
      block.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <strong style="color:var(--accent-green)">#${i + 1}</strong>
          <div>
            <small class="text-muted">Pieza</small>
            <select class="form-select form-select-sm" data-field="pieceId" style="width:70px">
              ${pieceIds.map(id => `<option value="${id}" ${id === s.pieceId ? 'selected' : ''}>${id}</option>`).join('')}
            </select>
          </div>
          <div>
            <small class="text-muted">Celda 1</small>
            <select class="form-select form-select-sm" data-field="cell1" style="width:70px">
              ${cells.map(c => `<option value="${c}" ${c === s.cell1 ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <small class="text-muted">Val 1</small>
            <input type="number" class="form-control form-control-sm" min="0" max="12" value="${s.val1}" data-field="val1" style="width:60px">
          </div>
          <div>
            <small class="text-muted">Celda 2</small>
            <select class="form-select form-select-sm" data-field="cell2" style="width:70px">
              ${cells.map(c => `<option value="${c}" ${c === s.cell2 ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <small class="text-muted">Val 2</small>
            <input type="number" class="form-control form-control-sm" min="0" max="12" value="${s.val2}" data-field="val2" style="width:60px">
          </div>
          <button class="btn-remove" data-action="remove">&times;</button>
        </div>`;
      const update = (field, val) => {
        if (field === 'pieceId') s.pieceId = parseInt(val);
        else if (field === 'val1' || field === 'val2') s[field] = parseInt(val) || 0;
        else s[field] = val;
        m.changed();
      };
      block.querySelectorAll('select, input').forEach(inp => {
        inp.addEventListener('change', () => update(inp.dataset.field, inp.value));
      });
      block.querySelector('[data-action="remove"]').addEventListener('click', () => {
        m.solution.splice(i, 1); m.changed();
      });
      el.appendChild(block);
    }
  }

  // ── Condiciones ─────────────────────────────────────
  _buildConditions() {
    const el = document.getElementById('conditions-list');
    if (!el) return;
    const m = this.model;
    const operators = ['>', '<', '>=', '<=', '=', 'sum'];
    el.innerHTML = '';
    for (let i = 0; i < m.conditions.length; i++) {
      const cond = m.conditions[i];
      const isSelecting = m.selectedConditionIndex === i;
      const block = document.createElement('div');
      block.className = `entry-card${isSelecting ? ' selecting' : ''}`;
      block.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
          <strong style="color:var(--accent-blue)">#${i + 1}</strong>
          <input type="text" class="form-control form-control-sm flex-grow-1" placeholder="A1, A2 o A1:B2"
            value="${cond.cells}" data-field="cells" id="cond-cells-${i}" style="min-width:120px">
          <button class="btn-select-grid btn btn-sm ${isSelecting ? 'active btn-info' : 'btn-outline-info'}" data-action="select-grid">
            ${isSelecting ? 'Listo' : 'Seleccionar en Cuadrícula'}
          </button>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <select class="form-select form-select-sm" data-field="operator" style="width:80px">
            ${operators.map(op => `<option value="${op}" ${op === cond.operator ? 'selected' : ''}>${op}</option>`).join('')}
          </select>
          <span class="${cond.operator === '=' ? 'd-none' : ''}" id="cond-val-wrap-${i}">
            <input type="number" class="form-control form-control-sm" min="0" max="100"
              value="${cond.value}" data-field="value" style="width:70px">
          </span>
          <button class="btn-remove" data-action="remove">&times;</button>
          <small class="text-muted" id="cond-help-${i}"></small>
        </div>`;

      const updateHelp = () => {
        const helpEl = block.querySelector(`#cond-help-${i}`);
        const n = parseCellList(cond.cells).length;
        if (cond.operator === '=') helpEl.textContent = 'Todas las celdas deben tener el mismo valor';
        else if (cond.operator === 'sum') helpEl.textContent = `La suma de ${n} celda(s) debe ser igual al valor`;
        else helpEl.textContent = n === 1 ? `Valor de celda ${cond.operator} valor` : `Suma de ${n} celdas ${cond.operator} valor`;
      };

      // Cells input: on input, update model + grid only (no tab rebuild = keeps focus)
      const cellsInput = block.querySelector(`#cond-cells-${i}`);
      cellsInput.addEventListener('input', () => {
        cond.cells = cellsInput.value;
        m.gridChanged();
      });
      // On blur, do a full rebuild to sync help text etc.
      cellsInput.addEventListener('blur', () => {
        m.changed();
      });

      // Operator and value: full rebuild on change
      block.querySelectorAll('select, input[data-field="value"]').forEach(inp => {
        inp.addEventListener('change', () => {
          if (inp.dataset.field === 'value') cond.value = parseInt(inp.value) || 0;
          else if (inp.dataset.field === 'operator') {
            cond.operator = inp.value;
            const wrap = block.querySelector(`#cond-val-wrap-${i}`);
            wrap.classList.toggle('d-none', inp.value === '=');
          }
          m.changed();
        });
      });

      block.querySelector('[data-action="select-grid"]').addEventListener('click', () => {
        m.selectedConditionIndex = isSelecting ? null : i;
        m.changed();
      });
      block.querySelector('[data-action="remove"]').addEventListener('click', () => {
        if (m.selectedConditionIndex === i) m.selectedConditionIndex = null;
        m.conditions.splice(i, 1);
        m.changed();
      });
      updateHelp();
      el.appendChild(block);
    }
  }

  _syncConditionInputs() {
    const m = this.model;
    if (m.selectedConditionIndex === null) return;
    const inp = document.getElementById(`cond-cells-${m.selectedConditionIndex}`);
    if (inp) inp.value = m.conditions[m.selectedConditionIndex].cells;
  }

  // ── Monstruos ───────────────────────────────────────
  _buildMonsters() {
    const el = document.getElementById('monsters-list');
    if (!el) return;
    const m = this.model;
    el.innerHTML = '';
    for (let i = 0; i < m.monsterCells.length; i++) {
      const mon = m.monsterCells[i];
      const block = document.createElement('div');
      block.className = 'entry-card';
      block.innerHTML = `
        <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
          <strong style="color:var(--accent-purple)">👾 #${i + 1}</strong>
          <div class="input-group input-group-sm" style="width:auto">
            <span class="input-group-text">Celda</span>
            <input type="text" class="form-control" value="${mon.cell}" data-field="cell" style="width:60px">
          </div>
          <div class="input-group input-group-sm" style="width:auto">
            <span class="input-group-text">Respuesta</span>
            <input type="number" class="form-control" min="0" max="999" value="${mon.answer}" data-field="answer" style="width:70px">
          </div>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <div class="input-group input-group-sm" style="width:auto">
            <span class="input-group-text">Expr</span>
            <input type="text" class="form-control" value="${mon.expression}" data-field="expression" placeholder="3*4-2" style="width:120px">
          </div>
          <div class="input-group input-group-sm" style="width:auto">
            <span class="input-group-text">Mostrar</span>
            <input type="text" class="form-control" value="${mon.display || ''}" data-field="display" placeholder="3×4−2" style="width:120px">
          </div>
          <button class="btn-remove" data-action="remove">&times;</button>
        </div>`;

      // Text inputs: update on input (grid only), full rebuild on blur
      block.querySelectorAll('input[type="text"]').forEach(inp => {
        inp.addEventListener('input', () => {
          if (inp.dataset.field === 'cell') mon.cell = inp.value.trim().toUpperCase();
          else mon[inp.dataset.field] = inp.value;
          m.gridChanged();
        });
        inp.addEventListener('blur', () => m.changed());
      });
      // Number inputs: full rebuild on change
      block.querySelectorAll('input[type="number"]').forEach(inp => {
        inp.addEventListener('change', () => {
          if (inp.dataset.field === 'answer') mon.answer = parseInt(inp.value) || 0;
          m.changed();
        });
      });
      block.querySelector('[data-action="remove"]').addEventListener('click', () => {
        m.monsterCells.splice(i, 1); m.changed();
      });
      el.appendChild(block);
    }

    // Solución de monstruos
    const msEl = document.getElementById('monster-solution-list');
    if (!msEl) return;
    const monsterNames = m.monsterCells.map(mc => mc.cell).filter(Boolean);
    const pieceIds = m.getPieceIds();
    msEl.innerHTML = '';
    for (let i = 0; i < m.monsterSolution.length; i++) {
      const ms = m.monsterSolution[i];
      const row = document.createElement('div');
      row.className = 'entry-card d-flex align-items-center gap-2 flex-wrap';
      row.innerHTML = `
        <strong style="color:var(--accent-purple)">#${i + 1}</strong>
        <select class="form-select form-select-sm" data-field="monsterCell" style="width:80px">
          ${monsterNames.map(c => `<option value="${c}" ${c === ms.monsterCell ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <span class="text-muted">→</span>
        <select class="form-select form-select-sm" data-field="pieceId" style="width:80px">
          ${pieceIds.map(id => `<option value="${id}" ${id === ms.pieceId ? 'selected' : ''}>${id}</option>`).join('')}
        </select>
        <button class="btn-remove" data-action="remove">&times;</button>`;
      row.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', () => {
          if (sel.dataset.field === 'pieceId') ms.pieceId = parseInt(sel.value);
          else ms[sel.dataset.field] = sel.value;
          m.changed();
        });
      });
      row.querySelector('[data-action="remove"]').addEventListener('click', () => {
        m.monsterSolution.splice(i, 1); m.changed();
      });
      msEl.appendChild(row);
    }
  }
}

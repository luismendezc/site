// Cell naming, parsing, range expansion, rotation computation

export function cellName(col, row) {
  return String.fromCharCode(65 + row) + (col + 1);
}

export function parseCell(name) {
  if (name.length < 2 || !/^[A-Za-z]/.test(name[0]) || !/^\d+$/.test(name.slice(1))) {
    throw new Error(`Invalid cell name: '${name}'`);
  }
  const row = name.charCodeAt(0) - (name[0] >= 'a' ? 97 : 65);
  const col = parseInt(name.slice(1), 10) - 1;
  if (row < 0 || col < 0) throw new Error(`Invalid cell name: '${name}'`);
  return [col, row];
}

export function expandRange(range) {
  const parts = range.split(':');
  if (parts.length !== 2) throw new Error(`Invalid range: '${range}'`);
  const [col1, row1] = parseCell(parts[0].trim());
  const [col2, row2] = parseCell(parts[1].trim());
  const minCol = Math.min(col1, col2), maxCol = Math.max(col1, col2);
  const minRow = Math.min(row1, row2), maxRow = Math.max(row1, row2);
  const cells = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.push(cellName(c, r));
    }
  }
  return cells;
}

export function parseCellList(text) {
  if (!text.trim()) return [];
  const parts = text.split(',');
  const seen = new Set();
  const result = [];
  for (const part of parts) {
    const trimmed = part.trim().toUpperCase();
    if (!trimmed) continue;
    let cells;
    if (trimmed.includes(':')) {
      cells = expandRange(trimmed);
    } else {
      cells = [trimmed];
    }
    for (const c of cells) {
      if (!seen.has(c)) {
        seen.add(c);
        result.push(c);
      }
    }
  }
  return result;
}

export function computeRotation(c1, c2, v1, v2, pieceLeft, pieceRight) {
  const [col1, row1] = parseCell(c1);
  const [col2, row2] = parseCell(c2);
  const horizontal = row1 === row2;
  const cell1HasLeft = (v1 === pieceLeft && v2 === pieceRight);

  if (horizontal) {
    const c1IsLeft = col1 < col2;
    if (cell1HasLeft) return c1IsLeft ? 0 : 2;
    else return c1IsLeft ? 2 : 0;
  } else {
    const c1IsTop = row1 < row2;
    if (cell1HasLeft) return c1IsTop ? 1 : 3;
    else return c1IsTop ? 3 : 1;
  }
}

export function areCellsAdjacent(c1, c2) {
  const [col1, row1] = parseCell(c1);
  const [col2, row2] = parseCell(c2);
  return Math.abs(col1 - col2) + Math.abs(row1 - row2) === 1;
}

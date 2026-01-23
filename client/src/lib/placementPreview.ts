import type { CellState, Coord, Direction, ShipKind } from '../game/types';
import { SHIP_SPECS } from '../game/types';
import { inBounds } from '../game/board';

function neighborsIncludingDiagonal(c: Coord): Coord[] {
  const coords: Coord[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      coords.push({ x: c.x + dx, y: c.y + dy });
    }
  }
  return coords;
}

export function computeShipCells(start: Coord, direction: Direction, kind: ShipKind): Coord[] {
  const size = SHIP_SPECS[kind].size;
  const cells: Coord[] = [];
  for (let i = 0; i < size; i++) {
    const x = direction === 'horizontal' ? start.x + i : start.x;
    const y = direction === 'vertical' ? start.y + i : start.y;
    cells.push({ x, y });
  }
  return cells;
}

export function canPlaceOnLocalBoard(board: CellState[][], cells: Coord[]): boolean {
  // match server rules: no overlap, in bounds, no adjacency including diagonal
  for (const c of cells) {
    if (!inBounds(c.x, c.y)) return false;
    if (board[c.y]?.[c.x] !== 'empty') return false;

    for (const n of neighborsIncludingDiagonal(c)) {
      if (!inBounds(n.x, n.y)) continue;
      if (board[n.y]?.[n.x] === 'ship') return false;
    }
  }

  return true;
}

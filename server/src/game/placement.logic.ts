import { BOARD_SIZE, inBounds } from './board';
import type { Cell, Coord, Direction, Ship, ShipKind } from './types';
import { FLEET_KINDS, SHIP_SPECS } from './types';

export type PlacementRule = {
  disallowAdjacent: boolean; // includes diagonal adjacency
};

export const DEFAULT_PLACEMENT_RULES: PlacementRule = {
  disallowAdjacent: true,
};

export function computeShipPositions(start: Coord, direction: Direction, size: number): Coord[] {
  const positions: Coord[] = [];
  for (let i = 0; i < size; i++) {
    const x = direction === 'horizontal' ? start.x + i : start.x;
    const y = direction === 'vertical' ? start.y + i : start.y;
    positions.push({ x, y });
  }
  return positions;
}

function neighborsIncludingDiagonal(coord: Coord): Coord[] {
  const coords: Coord[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      coords.push({ x: coord.x + dx, y: coord.y + dy });
    }
  }
  return coords;
}

export function canPlaceShip(
  board: Cell[][],
  start: Coord,
  direction: Direction,
  kind: ShipKind,
  rules: PlacementRule = DEFAULT_PLACEMENT_RULES,
): { ok: true; positions: Coord[] } | { ok: false; reason: string } {
  const size = SHIP_SPECS[kind].size;
  const positions = computeShipPositions(start, direction, size);

  for (const pos of positions) {
    if (!inBounds(pos.x, pos.y)) return { ok: false, reason: 'out_of_bounds' };
    if (board[pos.y]?.[pos.x]?.state !== 'empty') return { ok: false, reason: 'overlap' };

    if (rules.disallowAdjacent) {
      for (const n of neighborsIncludingDiagonal(pos)) {
        if (!inBounds(n.x, n.y)) continue;
        if (board[n.y][n.x].state === 'ship') return { ok: false, reason: 'adjacent' };
      }
    }
  }

  return { ok: true, positions };
}

export function placeShip(
  board: Cell[][],
  shipId: string,
  start: Coord,
  direction: Direction,
  kind: ShipKind,
  rules: PlacementRule = DEFAULT_PLACEMENT_RULES,
): { ok: true; ship: Ship } | { ok: false; reason: string } {
  const can = canPlaceShip(board, start, direction, kind, rules);
  if (!can.ok) return can;

  for (const pos of can.positions) {
    board[pos.y][pos.x].state = 'ship';
  }

  const ship: Ship = {
    id: shipId,
    kind,
    size: SHIP_SPECS[kind].size,
    positions: can.positions,
    hits: 0,
    sunk: false,
  };

  return { ok: true, ship };
}

export function allShipsPlaced(ships: Ship[]): boolean {
  const counts = new Map<ShipKind, number>();
  for (const s of ships) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  return FLEET_KINDS.every((k) => (counts.get(k) ?? 0) === 1);
}

export function resetBoardKeepingSize(board: Cell[][]): void {
  if (board.length !== BOARD_SIZE) {
    throw new Error('invalid_board');
  }
  for (const row of board) {
    if (row.length !== BOARD_SIZE) throw new Error('invalid_board');
    for (const cell of row) {
      cell.state = 'empty';
    }
  }
}

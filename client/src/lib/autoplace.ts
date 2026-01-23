import type { Direction, ShipKind } from '../game/types';
import { SHIP_SPECS } from '../game/types';
import { BOARD_SIZE, inBounds } from '../game/board';

type Placement = { kind: ShipKind; start: { x: number; y: number }; direction: Direction };

function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function neighborsIncludingDiagonal(x: number, y: number) {
  const coords: Array<{ x: number; y: number }> = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      coords.push({ x: x + dx, y: y + dy });
    }
  }
  return coords;
}

export function tryPlaceAllShipsLocally(): Placement[] {
  const occupied = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => false));

  const kinds: ShipKind[] = ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'];
  const placements: Placement[] = [];

  for (const kind of kinds) {
    const size = SHIP_SPECS[kind].size;
    let placed = false;

    for (let attempt = 0; attempt < 2000 && !placed; attempt++) {
      const direction: Direction = Math.random() < 0.5 ? 'horizontal' : 'vertical';
      const start = { x: randInt(BOARD_SIZE), y: randInt(BOARD_SIZE) };

      const coords: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < size; i++) {
        const x = direction === 'horizontal' ? start.x + i : start.x;
        const y = direction === 'vertical' ? start.y + i : start.y;
        coords.push({ x, y });
      }

      if (coords.some((c) => !inBounds(c.x, c.y))) continue;
      if (coords.some((c) => occupied[c.y][c.x])) continue;

      // no adjacency (including diagonal)
      let touches = false;
      for (const c of coords) {
        for (const n of neighborsIncludingDiagonal(c.x, c.y)) {
          if (!inBounds(n.x, n.y)) continue;
          if (occupied[n.y][n.x]) {
            touches = true;
            break;
          }
        }
        if (touches) break;
      }
      if (touches) continue;

      // commit
      for (const c of coords) occupied[c.y][c.x] = true;
      placements.push({ kind, start, direction });
      placed = true;
    }

    if (!placed) throw new Error('autoplace_failed');
  }

  return placements;
}

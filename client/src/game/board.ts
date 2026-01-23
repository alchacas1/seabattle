import type { CellState } from './types';

export const BOARD_SIZE = 10;

export function createBoard(fill: CellState = 'empty'): CellState[][] {
  const b: CellState[][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: CellState[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) row.push(fill);
    b.push(row);
  }
  return b;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

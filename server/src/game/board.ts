import type { Cell, CellState } from './types';

export const BOARD_SIZE = 10;

export function createBoard(fill: CellState = 'empty'): Cell[][] {
  const board: Cell[][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      row.push({ x, y, state: fill });
    }
    board.push(row);
  }
  return board;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

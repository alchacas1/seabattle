import { describe, expect, it } from 'vitest';
import { createBoard } from './board';
import { canPlaceShip, placeShip } from './placement.logic';

describe('placement.logic', () => {
  it('rejects out of bounds placement', () => {
    const board = createBoard('empty');
    const res = canPlaceShip(board, { x: 8, y: 0 }, 'horizontal', 'carrier'); // size 5
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('out_of_bounds');
  });

  it('rejects overlap', () => {
    const board = createBoard('empty');
    const first = placeShip(board, 's1', { x: 0, y: 0 }, 'horizontal', 'destroyer');
    expect(first.ok).toBe(true);

    const second = canPlaceShip(board, { x: 0, y: 0 }, 'vertical', 'submarine');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('overlap');
  });

  it('rejects adjacency (including diagonal) by default', () => {
    const board = createBoard('empty');
    const first = placeShip(board, 's1', { x: 0, y: 0 }, 'horizontal', 'destroyer');
    expect(first.ok).toBe(true);

    // Diagonal adjacency at (2,1) touches destroyer at (1,0)
    const second = canPlaceShip(board, { x: 2, y: 1 }, 'horizontal', 'destroyer');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('adjacent');
  });

  it('places ship and writes board cells', () => {
    const board = createBoard('empty');
    const placed = placeShip(board, 's1', { x: 3, y: 3 }, 'vertical', 'cruiser');
    expect(placed.ok).toBe(true);
    expect(board[3][3].state).toBe('ship');
    expect(board[4][3].state).toBe('ship');
    expect(board[5][3].state).toBe('ship');
  });
});

import { describe, expect, it } from 'vitest';
import { createBoard } from './board';
import type { Game, Player } from './types';
import { shoot } from './shot.logic';

function mkPlayer(id: string): Player {
  return {
    id,
    name: id,
    board: createBoard('empty'),
    ships: [],
    ready: true,
  };
}

describe('shot.logic', () => {
  it('enforces turn ownership', () => {
    const p1 = mkPlayer('p1');
    const p2 = mkPlayer('p2');

    const game: Game = {
      id: 'g1',
      players: [p1, p2],
      currentTurn: 'p1',
      status: 'playing',
    };

    expect(() => shoot(game, 'p2', 0, 0)).toThrowError('not_your_turn');
  });

  it('hit keeps turn; miss switches turn', () => {
    const p1 = mkPlayer('p1');
    const p2 = mkPlayer('p2');

    // Put a ship cell at (0,0) on p2 board
    p2.board[0][0].state = 'ship';
    p2.ships = [
      {
        id: 's1',
        kind: 's2_1',
        size: 2,
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        hits: 0,
        sunk: false,
      },
    ];

    const game: Game = {
      id: 'g1',
      players: [p1, p2],
      currentTurn: 'p1',
      status: 'playing',
    };

    const r1 = shoot(game, 'p1', 0, 0);
    expect(r1.type).toBe('hit');
    expect(game.currentTurn).toBe('p1');

    const r2 = shoot(game, 'p1', 9, 9);
    expect(r2.type).toBe('miss');
    expect(game.currentTurn).toBe('p2');
  });

  it('marks game over on sinking last ship', () => {
    const p1 = mkPlayer('p1');
    const p2 = mkPlayer('p2');

    p2.board[0][0].state = 'ship';
    p2.ships = [
      {
        id: 's1',
        kind: 's1_1',
        size: 1,
        positions: [{ x: 0, y: 0 }],
        hits: 0,
        sunk: false,
      },
    ];

    const game: Game = {
      id: 'g1',
      players: [p1, p2],
      currentTurn: 'p1',
      status: 'playing',
    };

    const res = shoot(game, 'p1', 0, 0);
    expect(res.type).toBe('hit');
    expect(res.gameOver).toBe(true);
    expect(res.winnerId).toBe('p1');
    expect(game.status).toBe('finished');
    expect(game.winnerId).toBe('p1');
  });
});

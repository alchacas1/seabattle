import { inBounds } from './board';
import type { Game, Player, ShotResult } from './types';

function findOpponent(game: Game, playerId: string): Player {
  const [p1, p2] = game.players;
  if (p1.id === playerId) return p2;
  if (p2.id === playerId) return p1;
  throw new Error('player_not_in_game');
}

function findPlayer(game: Game, playerId: string): Player {
  const [p1, p2] = game.players;
  if (p1.id === playerId) return p1;
  if (p2.id === playerId) return p2;
  throw new Error('player_not_in_game');
}

function updateShipState(opponent: Player, x: number, y: number): { sunkShipId?: string } {
  const ship = opponent.ships.find((s) => s.positions.some((p) => p.x === x && p.y === y));
  if (!ship) return {};

  ship.hits += 1;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    return { sunkShipId: ship.id };
  }
  return {};
}

function allShipsSunk(player: Player): boolean {
  return player.ships.length > 0 && player.ships.every((s) => s.sunk);
}

export function shoot(game: Game, playerId: string, x: number, y: number): ShotResult {
  if (game.status !== 'playing') throw new Error('game_not_playing');
  findPlayer(game, playerId);

  if (game.currentTurn !== playerId) throw new Error('not_your_turn');
  if (!inBounds(x, y)) throw new Error('out_of_bounds');

  const opponent = findOpponent(game, playerId);
  const target = opponent.board[y][x];

  if (target.state === 'hit' || target.state === 'miss') {
    throw new Error('already_shot');
  }

  if (target.state === 'ship') {
    target.state = 'hit';
    const { sunkShipId } = updateShipState(opponent, x, y);

    const result: ShotResult = { type: 'hit', x, y, sunkShipId };

    if (allShipsSunk(opponent)) {
      game.status = 'finished';
      game.winnerId = playerId;
      result.gameOver = true;
      result.winnerId = playerId;
      return result;
    }

    // On hit: keep turn (classic variant). If you want alternate rules, change here.
    return result;
  }

  target.state = 'miss';

  // switch turn on miss
  const [p1, p2] = game.players;
  game.currentTurn = p1.id === playerId ? p2.id : p1.id;

  return { type: 'miss', x, y };
}

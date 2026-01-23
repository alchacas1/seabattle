import { randomUUID } from 'crypto';
import { createBoard } from './board';
import { allShipsPlaced, DEFAULT_PLACEMENT_RULES, placeShip, resetBoardKeepingSize } from './placement.logic';
import { shoot } from './shot.logic';
import type { Direction, Game, Player, ShipKind } from './types';

export type CreateGameOptions = {
  placementRules?: typeof DEFAULT_PLACEMENT_RULES;
};

export type PlaceShipInput = {
  shipId?: string;
  kind: ShipKind;
  start: { x: number; y: number };
  direction: Direction;
};

export function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    board: createBoard('empty'),
    ships: [],
    ready: false,
  };
}

export function createGame(playerId: string, playerName: string): Game {
  const p1 = createPlayer(playerId, playerName);
  const p2 = createPlayer('', ''); // placeholder until join
  return {
    id: randomUUID(),
    players: [p1, p2],
    currentTurn: '',
    status: 'waiting',
  };
}

export function joinGame(game: Game, playerId: string, playerName: string): void {
  const [p1, p2] = game.players;
  if (p1.id === playerId) return;
  if (p2.id === playerId) return;

  if (p2.id) throw new Error('game_full');
  p2.id = playerId;
  p2.name = playerName;

  game.status = 'placing';
}

export function resetPlacements(game: Game, playerId: string): void {
  const player = getPlayer(game, playerId);
  resetBoardKeepingSize(player.board);
  player.ships = [];
  player.ready = false;
}

export function placeShipForPlayer(
  game: Game,
  playerId: string,
  input: PlaceShipInput,
  rules = DEFAULT_PLACEMENT_RULES,
): { ok: true } | { ok: false; reason: string } {
  if (game.status !== 'placing') return { ok: false, reason: 'not_in_placing' };

  const player = getPlayer(game, playerId);

  if (player.ships.some((s) => s.kind === input.kind)) {
    return { ok: false, reason: 'ship_kind_already_placed' };
  }

  const shipId = input.shipId ?? randomUUID();
  const placed = placeShip(player.board, shipId, input.start, input.direction, input.kind, rules);
  if (!placed.ok) return placed;

  player.ships.push(placed.ship);
  return { ok: true };
}

export function setPlayerReady(game: Game, playerId: string): { ok: true } | { ok: false; reason: string } {
  if (game.status !== 'placing') return { ok: false, reason: 'not_in_placing' };
  const player = getPlayer(game, playerId);

  if (!allShipsPlaced(player.ships)) return { ok: false, reason: 'not_all_ships_placed' };

  player.ready = true;

  const [p1, p2] = game.players;
  if (p1.ready && p2.ready) {
    game.status = 'playing';
    // P1 starts.
    game.currentTurn = p1.id;
  }

  return { ok: true };
}

export function performShot(game: Game, playerId: string, x: number, y: number) {
  return shoot(game, playerId, x, y);
}

export function getPlayer(game: Game, playerId: string): Player {
  const [p1, p2] = game.players;
  if (p1.id === playerId) return p1;
  if (p2.id === playerId) return p2;
  throw new Error('player_not_in_game');
}

export function getOpponent(game: Game, playerId: string): Player {
  const [p1, p2] = game.players;
  if (p1.id === playerId) return p2;
  if (p2.id === playerId) return p1;
  throw new Error('player_not_in_game');
}

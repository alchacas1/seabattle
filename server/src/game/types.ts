export type CellState = 'empty' | 'ship' | 'hit' | 'miss';

export interface Cell {
  x: number;
  y: number;
  state: CellState;
}

export type Direction = 'horizontal' | 'vertical';

export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export const SHIP_SPECS: Record<ShipKind, { size: number }> = {
  carrier: { size: 5 },
  battleship: { size: 4 },
  cruiser: { size: 3 },
  submarine: { size: 3 },
  destroyer: { size: 2 },
};

export interface Coord {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  kind: ShipKind;
  size: number;
  positions: Coord[];
  hits: number;
  sunk: boolean;
}

export interface Player {
  id: string;
  name: string;
  board: Cell[][];
  ships: Ship[];
  ready: boolean;
}

export type GameStatus = 'waiting' | 'placing' | 'playing' | 'finished';

export interface Game {
  id: string;
  players: [Player, Player];
  currentTurn: string; // playerId
  status: GameStatus;
  winnerId?: string;
}

export interface ShotResult {
  type: 'hit' | 'miss';
  x: number;
  y: number;
  sunkShipId?: string;
  gameOver?: boolean;
  winnerId?: string;
}

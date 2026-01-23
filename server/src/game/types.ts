export type CellState = 'empty' | 'ship' | 'hit' | 'miss';

export interface Cell {
  x: number;
  y: number;
  state: CellState;
}

export type Direction = 'horizontal' | 'vertical';

export const FLEET_KINDS = [
  's4_1',
  's3_1',
  's3_2',
  's2_1',
  's2_2',
  's2_3',
  's1_1',
  's1_2',
  's1_3',
  's1_4',
] as const;

export type ShipKind = (typeof FLEET_KINDS)[number];

export const SHIP_SPECS: Record<ShipKind, { size: number }> = {
  s4_1: { size: 4 },
  s3_1: { size: 3 },
  s3_2: { size: 3 },
  s2_1: { size: 2 },
  s2_2: { size: 2 },
  s2_3: { size: 2 },
  s1_1: { size: 1 },
  s1_2: { size: 1 },
  s1_3: { size: 1 },
  s1_4: { size: 1 },
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

import type {
  AttackResult,
  Coordinate,
  GameEvent,
  PlayerState,
  PublicBoard,
  PublicGameState,
  Ship,
} from "@sea-battle/shared-types";

export interface PrivateBoard {
  ownerId: string;
  ships: Ship[];
  mines: Coordinate[];
  antiAir: Coordinate[];
  submarine: Coordinate | null;
}

export interface ProcessedAction {
  actorId: string;
  type: "FLEET" | "ATTACK" | "WEAPON" | "REMATCH";
  response: unknown;
  createdAt: number;
}

export interface GameAggregate {
  game: PublicGameState;
  players: Record<string, PlayerState>;
  privateBoards: Record<string, PrivateBoard | undefined>;
  publicBoards: Record<string, PublicBoard | undefined>;
  processedActions: Record<string, ProcessedAction | undefined>;
  events?: GameEvent[];
}

export interface AttackResponse {
  actionId: string;
  row: number;
  col: number;
  result: AttackResult;
  turnNumber: number;
  winnerId: string | null;
  sunkShipSize?: number;
}

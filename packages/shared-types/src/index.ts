import { z } from "zod";

export const BOARD_SIZE = 10;
export const CLASSIC_FLEET_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1] as const;

export const gameStatusSchema = z.enum([
  "WAITING_PLAYER",
  "PLACING_SHIPS",
  "READY",
  "PLAYING",
  "FINISHED",
  "ABANDONED",
]);
export type GameStatus = z.infer<typeof gameStatusSchema>;

export const coordinateSchema = z.object({
  row: z
    .number()
    .int()
    .min(0)
    .max(BOARD_SIZE - 1),
  col: z
    .number()
    .int()
    .min(0)
    .max(BOARD_SIZE - 1),
});
export type Coordinate = z.infer<typeof coordinateSchema>;

export const orientationSchema = z.enum(["H", "V"]);
export type Orientation = z.infer<typeof orientationSchema>;

export const shipSchema = z.object({
  id: z.string().min(1).max(64),
  size: z.number().int().min(1).max(4),
  orientation: orientationSchema,
  cells: z.array(coordinateSchema).min(1).max(4),
  hits: z.array(coordinateSchema).max(4).default([]),
  sunk: z.boolean().default(false),
});
export type Ship = z.infer<typeof shipSchema>;

export const fleetSchema = z
  .array(shipSchema)
  .length(CLASSIC_FLEET_SIZES.length);
export type Fleet = z.infer<typeof fleetSchema>;

export const attackResultSchema = z.enum(["MISS", "HIT", "SUNK"]);
export type AttackResult = z.infer<typeof attackResultSchema>;
export type PublicCellState = AttackResult | "RADAR_OCCUPIED" | "RADAR_EMPTY";

export const weaponTypeSchema = z.enum([
  "fighter",
  "attackPlane",
  "torpedoPlane",
  "torpedoSquadron",
  "bomber",
  "nuclear",
  "antiAir",
  "mine",
  "submarine",
  "radar",
]);
export type WeaponType = z.infer<typeof weaponTypeSchema>;
export type WeaponInventory = Record<WeaponType, number>;

export interface GameRules {
  keepTurnOnHit: boolean;
  turnSeconds: number;
}

export interface PublicGameState {
  id: string;
  roomCode: string;
  status: GameStatus;
  player1Id: string;
  player2Id: string | null;
  currentTurnPlayerId: string | null;
  turnNumber: number;
  turnStartedAt: number | null;
  turnEndsAt: number | null;
  winnerId: string | null;
  rules: GameRules;
  createdAt: number;
  updatedAt: number;
  seriesId: string;
  rematchGameId?: string | null;
}

export interface PlayerState {
  uid: string;
  name: string;
  ready: boolean;
  fleetConfirmed: boolean;
  joinedAt: number;
  energy: number;
  inventory: WeaponInventory;
  stats?: {
    attacks: number;
    hits: number;
    misses: number;
    shipsSunk: number;
    weaponsUsed: number;
  };
}

export interface PublicBoard {
  ownerId: string;
  attackedCells: Record<string, AttackResult>;
  radarCells?: Record<string, "OCCUPIED" | "EMPTY">;
}

export type GameEventType =
  | "GAME_CREATED"
  | "PLAYER_JOINED"
  | "FLEET_CONFIRMED"
  | "GAME_STARTED"
  | "TURN_STARTED"
  | "ATTACK"
  | "SHIP_HIT"
  | "SHIP_SUNK"
  | "TURN_TIMEOUT"
  | "PLAYER_DISCONNECTED"
  | "PLAYER_RECONNECTED"
  | "WEAPON_USED"
  | "GAME_FINISHED";

export interface GameEvent {
  id: string;
  type: GameEventType;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
}

const normalizedNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(2).max(32));

const roomCodeSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-HJ-KM-NP-Z2-9]{6}$/));

export const createRoomInputSchema = z.object({
  playerName: normalizedNameSchema,
});
export const joinRoomInputSchema = z.object({
  playerName: normalizedNameSchema,
  roomCode: roomCodeSchema,
});
export const leaveRoomInputSchema = z.object({
  gameId: z.string().min(1).max(128),
});
export const gameActionSchema = z.object({
  gameId: z.string().min(1).max(128),
  actionId: z.string().uuid(),
});
export const attackInputSchema = gameActionSchema.extend({
  row: z
    .number()
    .int()
    .min(0)
    .max(BOARD_SIZE - 1),
  col: z
    .number()
    .int()
    .min(0)
    .max(BOARD_SIZE - 1),
});
export const submitFleetInputSchema = gameActionSchema.extend({
  fleet: fleetSchema,
});
export const useWeaponInputSchema = gameActionSchema.extend({
  weapon: weaponTypeSchema,
  target: z.unknown(),
});
export const rematchInputSchema = gameActionSchema;

export type CreateRoomInput = z.infer<typeof createRoomInputSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomInputSchema>;
export type AttackInput = z.infer<typeof attackInputSchema>;
export type SubmitFleetInput = z.infer<typeof submitFleetInputSchema>;
export type UseWeaponInput = z.infer<typeof useWeaponInputSchema>;

export const coordinateKey = ({ row, col }: Coordinate): string =>
  `${row}-${col}`;

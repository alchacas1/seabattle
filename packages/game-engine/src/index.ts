import {
  BOARD_SIZE,
  CLASSIC_FLEET_SIZES,
  coordinateKey,
  type AttackResult,
  type Coordinate,
  type GameRules,
  type Orientation,
  type Ship,
} from "@sea-battle/shared-types";

export class GameRuleError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "GameRuleError";
  }
}

export type PlacementFailure =
  | "OUT_OF_BOUNDS"
  | "INVALID_LENGTH"
  | "INVALID_SHAPE"
  | "OVERLAP"
  | "ADJACENT"
  | "INVALID_DISTRIBUTION";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: PlacementFailure };

export const isCoordinateInBounds = ({ row, col }: Coordinate): boolean =>
  Number.isInteger(row) &&
  Number.isInteger(col) &&
  row >= 0 &&
  row < BOARD_SIZE &&
  col >= 0 &&
  col < BOARD_SIZE;

const isStraightContiguous = (ship: Ship): boolean => {
  if (ship.cells.length !== ship.size) return false;
  const ordered = [...ship.cells].sort((a, b) =>
    ship.orientation === "H" ? a.col - b.col : a.row - b.row,
  );
  const fixedAxis =
    ship.orientation === "H"
      ? ordered.map((cell) => cell.row)
      : ordered.map((cell) => cell.col);
  const movingAxis =
    ship.orientation === "H"
      ? ordered.map((cell) => cell.col)
      : ordered.map((cell) => cell.row);
  return (
    new Set(fixedAxis).size === 1 &&
    movingAxis.every(
      (value, index) => index === 0 || value === movingAxis[index - 1]! + 1,
    )
  );
};

export function validateShipPlacement(
  existing: readonly Ship[],
  candidate: Ship,
): ValidationResult {
  if (!candidate.cells.every(isCoordinateInBounds))
    return { valid: false, reason: "OUT_OF_BOUNDS" };
  if (candidate.cells.length !== candidate.size)
    return { valid: false, reason: "INVALID_LENGTH" };
  if (!isStraightContiguous(candidate))
    return { valid: false, reason: "INVALID_SHAPE" };

  const occupied = new Set(
    existing.flatMap((ship) => ship.cells.map(coordinateKey)),
  );
  if (candidate.cells.some((cell) => occupied.has(coordinateKey(cell))))
    return { valid: false, reason: "OVERLAP" };

  const adjacent = candidate.cells.some((cell) =>
    existing.some((ship) =>
      ship.cells.some(
        (placed) =>
          Math.abs(cell.row - placed.row) <= 1 &&
          Math.abs(cell.col - placed.col) <= 1,
      ),
    ),
  );
  return adjacent ? { valid: false, reason: "ADJACENT" } : { valid: true };
}

export function validateFleet(fleet: readonly Ship[]): ValidationResult {
  const sizes = fleet.map((ship) => ship.size).sort((a, b) => b - a);
  if (
    sizes.join(",") !== [...CLASSIC_FLEET_SIZES].sort((a, b) => b - a).join(",")
  ) {
    return { valid: false, reason: "INVALID_DISTRIBUTION" };
  }
  const placed: Ship[] = [];
  for (const ship of fleet) {
    const result = validateShipPlacement(placed, ship);
    if (!result.valid) return result;
    placed.push(ship);
  }
  return { valid: true };
}

const makeShip = (
  id: string,
  size: number,
  orientation: Orientation,
  row: number,
  col: number,
): Ship => ({
  id,
  size,
  orientation,
  cells: Array.from({ length: size }, (_, index) => ({
    row: row + (orientation === "V" ? index : 0),
    col: col + (orientation === "H" ? index : 0),
  })),
  hits: [],
  sunk: false,
});

export function autoPlaceFleet(random: () => number = Math.random): Ship[] {
  const placed: Ship[] = [];
  CLASSIC_FLEET_SIZES.forEach((size, index) => {
    const candidates: Ship[] = [];
    for (const orientation of ["H", "V"] as const) {
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) {
          const ship = makeShip(
            `ship-${index + 1}`,
            size,
            orientation,
            row,
            col,
          );
          if (validateShipPlacement(placed, ship).valid) candidates.push(ship);
        }
      }
    }
    if (candidates.length === 0)
      throw new GameRuleError("FLEET_PLACEMENT_FAILED");
    const chosen =
      candidates[Math.floor(random() * candidates.length) % candidates.length];
    placed.push(chosen!);
  });
  return placed;
}

export interface AttackOutcome {
  result: AttackResult;
  victory: boolean;
  sunkShipSize?: number;
  updatedFleet: Ship[];
}

export function attackCell(
  fleet: readonly Ship[],
  attacked: ReadonlySet<string>,
  target: Coordinate,
): AttackOutcome {
  if (!isCoordinateInBounds(target))
    throw new GameRuleError("INVALID_COORDINATE");
  const key = coordinateKey(target);
  if (attacked.has(key)) throw new GameRuleError("CELL_ALREADY_ATTACKED");

  let result: AttackResult = "MISS";
  let sunkShipSize: number | undefined;
  const updatedFleet = fleet.map((ship) => {
    if (!ship.cells.some((cell) => coordinateKey(cell) === key))
      return { ...ship, cells: [...ship.cells], hits: [...ship.hits] };
    const hitKeys = new Set(ship.hits.map(coordinateKey));
    hitKeys.add(key);
    const hits = ship.cells.filter((cell) => hitKeys.has(coordinateKey(cell)));
    const sunk = hits.length === ship.cells.length;
    result = sunk ? "SUNK" : "HIT";
    if (sunk) sunkShipSize = ship.size;
    return { ...ship, cells: [...ship.cells], hits, sunk };
  });
  const victory = updatedFleet.every((ship) => ship.sunk);
  return {
    result,
    victory,
    ...(sunkShipSize === undefined ? {} : { sunkShipSize }),
    updatedFleet,
  };
}

export interface TurnState {
  status: "PLAYING" | string;
  playerIds: [string, string];
  currentTurnPlayerId: string;
  turnNumber: number;
  turnEndsAtMillis: number;
  rules: GameRules;
}

export function assertAttackAllowed(
  game: TurnState,
  uid: string,
  nowMillis: number,
): void {
  if (!game.playerIds.includes(uid)) throw new GameRuleError("NOT_A_PLAYER");
  if (game.status !== "PLAYING") throw new GameRuleError("GAME_NOT_PLAYING");
  if (game.currentTurnPlayerId !== uid)
    throw new GameRuleError("NOT_YOUR_TURN");
  if (nowMillis >= game.turnEndsAtMillis)
    throw new GameRuleError("TURN_EXPIRED");
}

export function advanceTurn<T extends TurnState>(
  game: T,
  result: AttackResult | "TIMEOUT",
  nowMillis: number,
  expectedTurnNumber?: number,
): T {
  if (
    expectedTurnNumber !== undefined &&
    expectedTurnNumber !== game.turnNumber
  )
    return game;
  const keepPlayer =
    result !== "MISS" && result !== "TIMEOUT" && game.rules.keepTurnOnHit;
  const currentIndex = game.playerIds.indexOf(game.currentTurnPlayerId);
  const currentTurnPlayerId = keepPlayer
    ? game.currentTurnPlayerId
    : game.playerIds[currentIndex === 0 ? 1 : 0]!;
  return {
    ...game,
    currentTurnPlayerId,
    turnNumber: game.turnNumber + 1,
    turnEndsAtMillis: nowMillis + game.rules.turnSeconds * 1000,
  };
}

export function createRoomCode(randomBytes: Uint8Array): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  if (randomBytes.length < 6)
    throw new GameRuleError("INSUFFICIENT_RANDOM_BYTES");
  return Array.from(
    randomBytes.slice(0, 6),
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
}

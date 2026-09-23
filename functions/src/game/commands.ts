import {
  advanceTurn,
  assertAttackAllowed,
  attackCell,
  GameRuleError,
  validateFleet,
} from "@sea-battle/game-engine";
import {
  coordinateKey,
  type Coordinate,
  type GameEvent,
  type Ship,
} from "@sea-battle/shared-types";
import type {
  AttackResponse,
  GameAggregate,
  ProcessedAction,
  PrivateBoard,
} from "./models.js";

export class DomainError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DomainError";
  }
}

const event = (
  type: GameEvent["type"],
  actorId: string | null,
  payload: Record<string, unknown>,
  createdAt: number,
): GameEvent => ({
  id: crypto.randomUUID(),
  type,
  actorId,
  payload,
  createdAt,
});

const cloneAggregate = (aggregate: GameAggregate): GameAggregate =>
  structuredClone(aggregate);

const existingAction = (
  aggregate: GameAggregate,
  uid: string,
  actionId: string,
  type: ProcessedAction["type"],
): ProcessedAction | undefined => {
  const action = aggregate.processedActions[actionId];
  if (!action) return undefined;
  if (action.actorId !== uid || action.type !== type)
    throw new DomainError("ACTION_ID_REUSED");
  return action;
};

const requirePlayer = (aggregate: GameAggregate, uid: string) => {
  const player = aggregate.players[uid];
  if (!player) throw new DomainError("NOT_A_PLAYER");
  return player;
};

export function applyFleetConfirmation(
  aggregate: GameAggregate,
  uid: string,
  actionId: string,
  fleet: readonly Ship[],
  now: number,
): GameAggregate {
  if (existingAction(aggregate, uid, actionId, "FLEET")) return aggregate;
  const player = requirePlayer(aggregate, uid);
  if (aggregate.game.status !== "PLACING_SHIPS")
    throw new DomainError("PLACEMENT_CLOSED");
  if (player.fleetConfirmed) throw new DomainError("FLEET_ALREADY_CONFIRMED");
  const validation = validateFleet(fleet);
  if (!validation.valid) throw new DomainError(validation.reason);

  const next = cloneAggregate(aggregate);
  const privateBoard: PrivateBoard = {
    ownerId: uid,
    ships: fleet.map((ship) => ({
      ...ship,
      cells: [...ship.cells],
      hits: [...ship.hits],
    })),
    mines: [],
    antiAir: [],
    submarine: null,
  };
  next.privateBoards[uid] = privateBoard;
  next.players[uid] = { ...player, ready: true, fleetConfirmed: true };
  next.processedActions[actionId] = {
    actorId: uid,
    type: "FLEET",
    response: { confirmed: true },
    createdAt: now,
  };
  next.events = [
    ...(next.events ?? []),
    event("FLEET_CONFIRMED", uid, {}, now),
  ];
  next.game.updatedAt = now;

  const bothReady =
    next.game.player2Id !== null &&
    [next.game.player1Id, next.game.player2Id].every(
      (id) => next.players[id]?.fleetConfirmed,
    );
  if (bothReady) {
    next.game.status = "PLAYING";
    next.game.currentTurnPlayerId = next.game.player1Id;
    next.game.turnNumber = 1;
    next.game.turnStartedAt = now;
    next.game.turnEndsAt = now + next.game.rules.turnSeconds * 1000;
    next.events.push(event("GAME_STARTED", null, {}, now));
    next.events.push(
      event("TURN_STARTED", next.game.player1Id, { turnNumber: 1 }, now),
    );
  }
  return next;
}

export function applyAttack(
  aggregate: GameAggregate,
  uid: string,
  actionId: string,
  target: Coordinate,
  now: number,
): { aggregate: GameAggregate; response: AttackResponse } {
  const processed = existingAction(aggregate, uid, actionId, "ATTACK");
  if (processed)
    return {
      aggregate,
      response: processed.response as unknown as AttackResponse,
    };
  if (
    !aggregate.game.player2Id ||
    !aggregate.game.currentTurnPlayerId ||
    aggregate.game.turnEndsAt === null
  ) {
    throw new DomainError("GAME_NOT_PLAYING");
  }
  try {
    assertAttackAllowed(
      {
        status: aggregate.game.status,
        playerIds: [aggregate.game.player1Id, aggregate.game.player2Id],
        currentTurnPlayerId: aggregate.game.currentTurnPlayerId,
        turnNumber: aggregate.game.turnNumber,
        turnEndsAtMillis: aggregate.game.turnEndsAt,
        rules: aggregate.game.rules,
      },
      uid,
      now,
    );
  } catch (error) {
    if (error instanceof GameRuleError) throw new DomainError(error.code);
    throw error;
  }

  const defenderId =
    uid === aggregate.game.player1Id
      ? aggregate.game.player2Id
      : aggregate.game.player1Id;
  const privateBoard = aggregate.privateBoards[defenderId];
  const publicBoard = aggregate.publicBoards[defenderId];
  if (!privateBoard || !publicBoard) throw new DomainError("BOARD_NOT_FOUND");
  let outcome;
  try {
    outcome = attackCell(
      privateBoard.ships,
      new Set(Object.keys(publicBoard.attackedCells)),
      target,
    );
  } catch (error) {
    if (error instanceof GameRuleError) throw new DomainError(error.code);
    throw error;
  }

  const next = cloneAggregate(aggregate);
  next.privateBoards[defenderId] = {
    ...privateBoard,
    ships: outcome.updatedFleet,
  };
  next.publicBoards[defenderId] = {
    ...publicBoard,
    attackedCells: {
      ...Object.fromEntries(
        outcome.revealedWater.map((cell) => [coordinateKey(cell), "MISS"]),
      ),
      ...publicBoard.attackedCells,
      ...Object.fromEntries(
        outcome.sunkShipCells.map((cell) => [coordinateKey(cell), "SUNK"]),
      ),
      [coordinateKey(target)]: outcome.result,
    },
  };
  const attacker = next.players[uid]!;
  const stats = attacker.stats ?? {
    attacks: 0,
    hits: 0,
    misses: 0,
    shipsSunk: 0,
    weaponsUsed: 0,
  };
  next.players[uid] = {
    ...attacker,
    stats: {
      ...stats,
      attacks: stats.attacks + 1,
      hits: stats.hits + (outcome.result === "MISS" ? 0 : 1),
      misses: stats.misses + (outcome.result === "MISS" ? 1 : 0),
      shipsSunk: stats.shipsSunk + (outcome.result === "SUNK" ? 1 : 0),
    },
  };
  const response: AttackResponse = {
    actionId,
    row: target.row,
    col: target.col,
    result: outcome.result,
    turnNumber: aggregate.game.turnNumber,
    winnerId: outcome.victory ? uid : null,
    ...(outcome.sunkShipSize === undefined
      ? {}
      : { sunkShipSize: outcome.sunkShipSize }),
  };
  next.processedActions[actionId] = {
    actorId: uid,
    type: "ATTACK",
    response,
    createdAt: now,
  };
  next.events = [
    ...(next.events ?? []),
    event(
      "ATTACK",
      uid,
      { row: target.row, col: target.col, result: outcome.result },
      now,
    ),
    ...(outcome.result === "HIT"
      ? [event("SHIP_HIT", uid, { row: target.row, col: target.col }, now)]
      : []),
    ...(outcome.result === "SUNK"
      ? [event("SHIP_SUNK", uid, { shipSize: outcome.sunkShipSize }, now)]
      : []),
  ];

  if (outcome.victory) {
    next.game = {
      ...next.game,
      status: "FINISHED",
      winnerId: uid,
      currentTurnPlayerId: null,
      turnEndsAt: null,
      updatedAt: now,
    };
    next.events.push(event("GAME_FINISHED", uid, {}, now));
    return { aggregate: next, response };
  }

  const advanced = advanceTurn(
    {
      status: next.game.status,
      playerIds: [next.game.player1Id, next.game.player2Id!],
      currentTurnPlayerId: next.game.currentTurnPlayerId!,
      turnNumber: next.game.turnNumber,
      turnEndsAtMillis: next.game.turnEndsAt!,
      rules: next.game.rules,
    },
    outcome.result,
    now,
  );
  next.game = {
    ...next.game,
    currentTurnPlayerId: advanced.currentTurnPlayerId,
    turnNumber: advanced.turnNumber,
    turnStartedAt: now,
    turnEndsAt: advanced.turnEndsAtMillis,
    updatedAt: now,
  };
  next.events.push(
    event(
      "TURN_STARTED",
      advanced.currentTurnPlayerId,
      { turnNumber: advanced.turnNumber },
      now,
    ),
  );
  return { aggregate: next, response };
}

export function applyTurnTimeout(
  aggregate: GameAggregate,
  expectedTurnNumber: number,
  now: number,
): GameAggregate {
  if (
    aggregate.game.status !== "PLAYING" ||
    aggregate.game.turnNumber !== expectedTurnNumber ||
    aggregate.game.turnEndsAt === null ||
    aggregate.game.turnEndsAt > now ||
    !aggregate.game.player2Id ||
    !aggregate.game.currentTurnPlayerId
  ) {
    return aggregate;
  }
  const player2Id = aggregate.game.player2Id;
  const currentTurnPlayerId = aggregate.game.currentTurnPlayerId;
  const next = cloneAggregate(aggregate);
  const advanced = advanceTurn(
    {
      status: next.game.status,
      playerIds: [next.game.player1Id, player2Id],
      currentTurnPlayerId,
      turnNumber: next.game.turnNumber,
      turnEndsAtMillis: next.game.turnEndsAt!,
      rules: next.game.rules,
    },
    "TIMEOUT",
    now,
    expectedTurnNumber,
  );
  next.game = {
    ...next.game,
    currentTurnPlayerId: advanced.currentTurnPlayerId,
    turnNumber: advanced.turnNumber,
    turnStartedAt: now,
    turnEndsAt: advanced.turnEndsAtMillis,
    updatedAt: now,
  };
  next.events = [
    ...(next.events ?? []),
    event(
      "TURN_TIMEOUT",
      aggregate.game.currentTurnPlayerId,
      { turnNumber: expectedTurnNumber },
      now,
    ),
    event(
      "TURN_STARTED",
      advanced.currentTurnPlayerId,
      { turnNumber: advanced.turnNumber },
      now,
    ),
  ];
  return next;
}

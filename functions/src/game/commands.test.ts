import { describe, expect, it } from "vitest";
import { autoPlaceFleet } from "@sea-battle/game-engine";
import {
  applyAttack,
  applyFleetConfirmation,
  applyTurnTimeout,
  DomainError,
} from "./commands.js";
import type { GameAggregate } from "./models.js";

const aggregate = (): GameAggregate => ({
  game: {
    id: "game-1",
    roomCode: "K7F2QX",
    status: "PLACING_SHIPS",
    player1Id: "one",
    player2Id: "two",
    currentTurnPlayerId: null,
    turnNumber: 0,
    turnStartedAt: null,
    turnEndsAt: null,
    winnerId: null,
    rules: { keepTurnOnHit: true, turnSeconds: 30 },
    createdAt: 1_000,
    updatedAt: 1_000,
    seriesId: "series-1",
  },
  players: {
    one: {
      uid: "one",
      name: "One",
      ready: false,
      fleetConfirmed: false,
      joinedAt: 1_000,
      energy: 0,
      inventory: {
        fighter: 0,
        attackPlane: 0,
        torpedoPlane: 0,
        torpedoSquadron: 0,
        bomber: 0,
        nuclear: 0,
        antiAir: 1,
        mine: 3,
        submarine: 1,
        radar: 2,
      },
    },
    two: {
      uid: "two",
      name: "Two",
      ready: false,
      fleetConfirmed: false,
      joinedAt: 1_100,
      energy: 0,
      inventory: {
        fighter: 0,
        attackPlane: 0,
        torpedoPlane: 0,
        torpedoSquadron: 0,
        bomber: 0,
        nuclear: 0,
        antiAir: 1,
        mine: 3,
        submarine: 1,
        radar: 2,
      },
    },
  },
  privateBoards: {},
  publicBoards: {
    one: { ownerId: "one", attackedCells: {} },
    two: { ownerId: "two", attackedCells: {} },
  },
  processedActions: {},
});

describe("fleet confirmation command", () => {
  it("starts the game only after both valid fleets are confirmed", () => {
    const first = applyFleetConfirmation(
      aggregate(),
      "one",
      "11111111-1111-4111-8111-111111111111",
      autoPlaceFleet(() => 0.2),
      2_000,
    );
    expect(first.game.status).toBe("PLACING_SHIPS");
    expect(first.privateBoards.one?.ships).toHaveLength(10);

    const second = applyFleetConfirmation(
      first,
      "two",
      "22222222-2222-4222-8222-222222222222",
      autoPlaceFleet(() => 0.7),
      3_000,
    );
    expect(second.game).toMatchObject({
      status: "PLAYING",
      currentTurnPlayerId: "one",
      turnNumber: 1,
      turnEndsAt: 33_000,
    });
  });

  it("returns the same aggregate for a repeated action id", () => {
    const actionId = "11111111-1111-4111-8111-111111111111";
    const first = applyFleetConfirmation(
      aggregate(),
      "one",
      actionId,
      autoPlaceFleet(() => 0.2),
      2_000,
    );
    expect(
      applyFleetConfirmation(
        first,
        "one",
        actionId,
        autoPlaceFleet(() => 0.7),
        9_000,
      ),
    ).toEqual(first);
  });
});

describe("attack command", () => {
  const ready = (): GameAggregate => {
    const one = applyFleetConfirmation(
      aggregate(),
      "one",
      "11111111-1111-4111-8111-111111111111",
      autoPlaceFleet(() => 0.2),
      2_000,
    );
    return applyFleetConfirmation(
      one,
      "two",
      "22222222-2222-4222-8222-222222222222",
      autoPlaceFleet(() => 0.7),
      3_000,
    );
  };

  it("processes one authoritative attack and makes retries idempotent", () => {
    const initial = ready();
    const actionId = "33333333-3333-4333-8333-333333333333";
    const target = initial.privateBoards.two!.ships[0]!.cells[0]!;
    const first = applyAttack(initial, "one", actionId, target, 4_000);
    expect(first.response).toMatchObject({
      result: "HIT",
      row: target.row,
      col: target.col,
    });
    expect(
      first.aggregate.publicBoards.two!.attackedCells[
        `${target.row}-${target.col}`
      ],
    ).toBe("HIT");
    expect(first.aggregate.players.one?.stats).toEqual({
      attacks: 1,
      hits: 1,
      misses: 0,
      shipsSunk: 0,
      weaponsUsed: 0,
    });

    const retry = applyAttack(first.aggregate, "one", actionId, target, 5_000);
    expect(retry.response).toEqual(first.response);
    expect(retry.aggregate).toEqual(first.aggregate);
  });

  it("publishes every sunk segment and surrounding water without counting extra attacks", () => {
    const initial = ready();
    initial.privateBoards.two!.ships = [
      {
        id: "corner-destroyer",
        size: 2,
        orientation: "H",
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        hits: [{ row: 0, col: 0 }],
        sunk: false,
      },
    ];
    initial.publicBoards.two!.attackedCells = {
      "0-0": "HIT",
      "1-0": "MISS",
    };

    const result = applyAttack(
      initial,
      "one",
      "55555555-5555-4555-8555-555555555555",
      { row: 0, col: 1 },
      4_000,
    );

    expect(result.aggregate.publicBoards.two!.attackedCells).toEqual({
      "0-0": "SUNK",
      "0-1": "SUNK",
      "0-2": "MISS",
      "1-0": "MISS",
      "1-1": "MISS",
      "1-2": "MISS",
    });
    expect(result.aggregate.players.one?.stats).toEqual({
      attacks: 1,
      hits: 1,
      misses: 0,
      shipsSunk: 1,
      weaponsUsed: 0,
    });
  });

  it("rejects attacks from the wrong player and after the deadline", () => {
    const initial = ready();
    expect(() =>
      applyAttack(
        initial,
        "two",
        "33333333-3333-4333-8333-333333333333",
        { row: 0, col: 0 },
        4_000,
      ),
    ).toThrowError(new DomainError("NOT_YOUR_TURN"));
    expect(() =>
      applyAttack(
        initial,
        "one",
        "44444444-4444-4444-8444-444444444444",
        { row: 0, col: 0 },
        33_001,
      ),
    ).toThrowError(new DomainError("TURN_EXPIRED"));
  });
});

describe("turn timeout command", () => {
  it("changes only the matching active turn", () => {
    const one = applyFleetConfirmation(
      aggregate(),
      "one",
      "11111111-1111-4111-8111-111111111111",
      autoPlaceFleet(() => 0.2),
      2_000,
    );
    const playing = applyFleetConfirmation(
      one,
      "two",
      "22222222-2222-4222-8222-222222222222",
      autoPlaceFleet(() => 0.7),
      3_000,
    );
    expect(applyTurnTimeout(playing, 0, 33_000)).toEqual(playing);
    expect(applyTurnTimeout(playing, 1, 33_000).game).toMatchObject({
      currentTurnPlayerId: "two",
      turnNumber: 2,
      turnEndsAt: 63_000,
    });
  });
});

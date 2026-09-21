import { describe, expect, it } from "vitest";
import { advanceTurn, assertAttackAllowed, GameRuleError } from "./index.js";

const playingGame = {
  status: "PLAYING" as const,
  playerIds: ["one", "two"] as [string, string],
  currentTurnPlayerId: "one",
  turnNumber: 7,
  turnEndsAtMillis: 30_000,
  rules: { keepTurnOnHit: true, turnSeconds: 30 },
};

describe("authoritative turns", () => {
  it("rejects an outsider, an out-of-turn player, and an expired request", () => {
    expect(() =>
      assertAttackAllowed(playingGame, "outsider", 20_000),
    ).toThrowError(new GameRuleError("NOT_A_PLAYER"));
    expect(() => assertAttackAllowed(playingGame, "two", 20_000)).toThrowError(
      new GameRuleError("NOT_YOUR_TURN"),
    );
    expect(() => assertAttackAllowed(playingGame, "one", 30_001)).toThrowError(
      new GameRuleError("TURN_EXPIRED"),
    );
  });

  it("accepts 29.999 seconds and rejects 30.001 seconds", () => {
    expect(() => assertAttackAllowed(playingGame, "one", 29_999)).not.toThrow();
    expect(() => assertAttackAllowed(playingGame, "one", 30_001)).toThrowError(
      new GameRuleError("TURN_EXPIRED"),
    );
  });

  it("keeps the turn on a hit when configured and otherwise advances it", () => {
    expect(advanceTurn(playingGame, "HIT", 10_000)).toMatchObject({
      currentTurnPlayerId: "one",
      turnNumber: 8,
      turnEndsAtMillis: 40_000,
    });
    expect(advanceTurn(playingGame, "MISS", 10_000)).toMatchObject({
      currentTurnPlayerId: "two",
      turnNumber: 8,
      turnEndsAtMillis: 40_000,
    });
  });

  it("ignores a stale timeout and advances the matching turn", () => {
    expect(advanceTurn(playingGame, "TIMEOUT", 30_000, 6)).toEqual(playingGame);
    expect(advanceTurn(playingGame, "TIMEOUT", 30_000, 7)).toMatchObject({
      currentTurnPlayerId: "two",
      turnNumber: 8,
    });
  });
});

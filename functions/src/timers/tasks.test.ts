import { describe, expect, it } from "vitest";
import type { PublicGameState } from "@sea-battle/shared-types";
import { timeoutWaitMillis } from "./tasks.js";

const game = (overrides: Partial<PublicGameState> = {}): PublicGameState => ({
  id: "game-1",
  roomCode: "K7F2QX",
  status: "PLAYING",
  player1Id: "one",
  player2Id: "two",
  currentTurnPlayerId: "one",
  turnNumber: 4,
  turnStartedAt: 10_000,
  turnEndsAt: 40_000,
  winnerId: null,
  rules: { keepTurnOnHit: true, turnSeconds: 30 },
  createdAt: 1_000,
  updatedAt: 10_000,
  seriesId: "series-1",
  ...overrides,
});

describe("turn timeout scheduling", () => {
  it("waits until the authoritative deadline when a task is delivered early", () => {
    expect(timeoutWaitMillis(game(), 4, 12_500)).toBe(27_500);
  });

  it("does not wait for stale or already-due tasks", () => {
    expect(timeoutWaitMillis(game(), 3, 12_500)).toBe(0);
    expect(timeoutWaitMillis(game(), 4, 40_000)).toBe(0);
  });
});

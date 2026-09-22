import { onTaskDispatched } from "firebase-functions/v2/tasks";
import type { PublicGameState } from "@sea-battle/shared-types";
import { applyTurnTimeout } from "../game/commands.js";
import {
  deserializeGame,
  loadAggregate,
  persistAggregate,
} from "../game/firestore.js";
import { db } from "../firebase.js";
import { scheduleTurnTimeout } from "./scheduler.js";

interface TimeoutPayload {
  gameId: string;
  turnNumber: number;
}

export function timeoutWaitMillis(
  game: PublicGameState,
  expectedTurnNumber: number,
  now: number,
): number {
  if (
    game.status !== "PLAYING" ||
    game.turnNumber !== expectedTurnNumber ||
    game.turnEndsAt === null
  )
    return 0;
  return Math.max(0, game.turnEndsAt - now);
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const handleTurnTimeout = onTaskDispatched<TimeoutPayload>(
  {
    region: "us-central1",
    timeoutSeconds: 90,
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 5 },
    rateLimits: { maxConcurrentDispatches: 20 },
  },
  async (request) => {
    const { gameId, turnNumber } = request.data;
    if (typeof gameId !== "string" || !Number.isInteger(turnNumber)) return;

    // The Firebase Tasks emulator currently dispatches delayed tasks at once.
    // Waiting outside the transaction keeps local behavior aligned with Cloud Tasks.
    const gameSnapshot = await db.collection("games").doc(gameId).get();
    if (!gameSnapshot.exists) return;
    const initialGame = deserializeGame(gameId, gameSnapshot.data()!);
    const earlyBy = timeoutWaitMillis(initialGame, turnNumber, Date.now());
    if (earlyBy > 0) await wait(earlyBy);

    const now = Date.now();
    const result = await db.runTransaction(async (transaction) => {
      const aggregate = await loadAggregate(db, transaction, gameId);
      const updated = applyTurnTimeout(aggregate, turnNumber, now);
      if (updated === aggregate) return null;
      persistAggregate(db, transaction, updated);
      return {
        turnNumber: updated.game.turnNumber,
        turnEndsAt: updated.game.turnEndsAt,
      };
    });
    if (result?.turnEndsAt)
      await scheduleTurnTimeout(
        { gameId, turnNumber: result.turnNumber },
        result.turnEndsAt,
      );
  },
);

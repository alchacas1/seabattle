import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { applyTurnTimeout } from "../game/commands.js";
import { loadAggregate, persistAggregate } from "../game/firestore.js";
import { db } from "../firebase.js";
import { scheduleTurnTimeout } from "./scheduler.js";

interface TimeoutPayload {
  gameId: string;
  turnNumber: number;
}

export const handleTurnTimeout = onTaskDispatched<TimeoutPayload>(
  {
    region: "us-central1",
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 5 },
    rateLimits: { maxConcurrentDispatches: 20 },
  },
  async (request) => {
    const { gameId, turnNumber } = request.data;
    if (typeof gameId !== "string" || !Number.isInteger(turnNumber)) return;
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

import { onCall } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";
import { autoPlaceFleet as generateFleet } from "@sea-battle/game-engine";
import {
  attackInputSchema,
  gameActionSchema,
  submitFleetInputSchema,
} from "@sea-battle/shared-types";
import { db } from "../firebase.js";
import { asHttpsError } from "../errors.js";
import { applyAttack, applyFleetConfirmation } from "./commands.js";
import { loadAggregate, persistAggregate } from "./firestore.js";
import { prepareRateLimit } from "../security/rate-limit.js";
import { scheduleTurnTimeout } from "../timers/scheduler.js";

const callableOptions = { region: "us-central1", cors: true } as const;

const uidOf = (request: { auth?: { uid: string } }): string => {
  if (!request.auth) throw new Error("UNAUTHENTICATED");
  return request.auth.uid;
};

export const autoPlaceFleet = onCall(callableOptions, (request) => {
  try {
    uidOf(request);
    gameActionSchema.pick({ gameId: true }).parse(request.data);
    return { fleet: generateFleet() };
  } catch (error) {
    return asHttpsError(error);
  }
});

const confirmFleetHandler = onCall(callableOptions, async (request) => {
  try {
    const uid = uidOf(request);
    const input = submitFleetInputSchema.parse(request.data);
    const now = Date.now();
    const result = await db.runTransaction(async (transaction) => {
      const commitRateLimit = await prepareRateLimit(db, transaction, uid, now);
      const aggregate = await loadAggregate(
        db,
        transaction,
        input.gameId,
        input.actionId,
      );
      const updated = applyFleetConfirmation(
        aggregate,
        uid,
        input.actionId,
        input.fleet,
        now,
      );
      commitRateLimit();
      persistAggregate(db, transaction, updated, input.actionId);
      return {
        started: updated.game.status === "PLAYING",
        turnNumber: updated.game.turnNumber,
        turnEndsAt: updated.game.turnEndsAt,
      };
    });
    if (result.started && result.turnEndsAt !== null) {
      await scheduleTurnTimeout(
        { gameId: input.gameId, turnNumber: result.turnNumber },
        result.turnEndsAt,
      );
    }
    return result;
  } catch (error) {
    return asHttpsError(error);
  }
});

export const submitFleet = confirmFleetHandler;
export const confirmFleet = confirmFleetHandler;

export const attack = onCall(callableOptions, async (request) => {
  try {
    const uid = uidOf(request);
    const input = attackInputSchema.parse(request.data);
    const now = Date.now();
    const result = await db.runTransaction(async (transaction) => {
      const commitRateLimit = await prepareRateLimit(db, transaction, uid, now);
      const aggregate = await loadAggregate(
        db,
        transaction,
        input.gameId,
        input.actionId,
      );
      const outcome = applyAttack(
        aggregate,
        uid,
        input.actionId,
        { row: input.row, col: input.col },
        now,
      );
      commitRateLimit();
      persistAggregate(db, transaction, outcome.aggregate, input.actionId);
      const attackRef = db
        .collection("games")
        .doc(input.gameId)
        .collection("attacks")
        .doc(input.actionId);
      transaction.set(attackRef, {
        ...outcome.response,
        attackerId: uid,
        createdAt: Timestamp.fromMillis(now),
      });
      if (outcome.aggregate.game.status === "FINISHED") {
        transaction.delete(
          db.collection("activeGames").doc(outcome.aggregate.game.player1Id),
        );
        if (outcome.aggregate.game.player2Id)
          transaction.delete(
            db.collection("activeGames").doc(outcome.aggregate.game.player2Id),
          );
      }
      return {
        response: outcome.response,
        nextTurnNumber: outcome.aggregate.game.turnNumber,
        nextTurnEndsAt: outcome.aggregate.game.turnEndsAt,
        finished: outcome.aggregate.game.status === "FINISHED",
      };
    });
    if (!result.finished && result.nextTurnEndsAt !== null) {
      await scheduleTurnTimeout(
        { gameId: input.gameId, turnNumber: result.nextTurnNumber },
        result.nextTurnEndsAt,
      );
    }
    return result.response;
  } catch (error) {
    return asHttpsError(error);
  }
});

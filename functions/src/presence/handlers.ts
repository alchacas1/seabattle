import { randomUUID } from "node:crypto";
import { getDatabase } from "firebase-admin/database";
import { Timestamp } from "firebase-admin/firestore";
import { onValueWritten } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../firebase.js";
import { serializeEvent } from "../game/firestore.js";

export const recordPresenceChange = onValueWritten(
  { ref: "/presence/{uid}", region: "us-central1" },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data.before.val() as {
      online?: boolean;
      gameId?: string;
    } | null;
    const after = event.data.after.val() as {
      online?: boolean;
      gameId?: string;
    } | null;
    if (before?.online === after?.online || !after?.gameId) return;
    const gameRef = db.collection("games").doc(after.gameId);
    const game = await gameRef.get();
    if (
      !game.exists ||
      (game.get("player1Id") !== uid && game.get("player2Id") !== uid)
    )
      return;
    const now = Date.now();
    const type = after.online ? "PLAYER_RECONNECTED" : "PLAYER_DISCONNECTED";
    await gameRef
      .collection("events")
      .doc()
      .set(
        serializeEvent({
          id: randomUUID(),
          type,
          actorId: uid,
          payload: {},
          createdAt: now,
        }),
      );
  },
);

export const handleDisconnectCleanup = onSchedule(
  { schedule: "every 1 minutes", region: "us-central1", timeoutSeconds: 120 },
  async () => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const games = await db
      .collection("games")
      .where("status", "==", "PLAYING")
      .limit(100)
      .get();
    const realtime = getDatabase();
    for (const snapshot of games.docs) {
      const data = snapshot.data();
      const playerIds = [String(data.player1Id), String(data.player2Id)];
      const presence = await Promise.all(
        playerIds.map((uid) => realtime.ref(`presence/${uid}`).get()),
      );
      const abandonedIndex = presence.findIndex((item) => {
        const value = item.val() as {
          online?: boolean;
          lastSeen?: number;
        } | null;
        return (
          value?.online === false &&
          typeof value.lastSeen === "number" &&
          value.lastSeen <= cutoff
        );
      });
      if (abandonedIndex < 0) continue;
      const abandonedId = playerIds[abandonedIndex]!;
      const winnerId = playerIds[abandonedIndex === 0 ? 1 : 0]!;
      await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(snapshot.ref);
        if (!fresh.exists || fresh.get("status") !== "PLAYING") return;
        const now = Date.now();
        transaction.update(snapshot.ref, {
          status: "ABANDONED",
          winnerId,
          currentTurnPlayerId: null,
          turnEndsAt: null,
          updatedAt: Timestamp.fromMillis(now),
        });
        transaction.delete(db.collection("activeGames").doc(abandonedId));
        transaction.delete(db.collection("activeGames").doc(winnerId));
        transaction.set(
          snapshot.ref.collection("events").doc(),
          serializeEvent({
            id: randomUUID(),
            type: "GAME_FINISHED",
            actorId: winnerId,
            payload: { reason: "DISCONNECT_TIMEOUT", abandonedId },
            createdAt: now,
          }),
        );
      });
    }
  },
);

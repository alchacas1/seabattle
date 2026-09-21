import { randomBytes, randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { createRoomCode } from "@sea-battle/game-engine";
import {
  gameActionSchema,
  type PlayerState,
  type PublicGameState,
} from "@sea-battle/shared-types";
import { asHttpsError } from "../errors.js";
import { db } from "../firebase.js";
import {
  deserializePlayer,
  serializeEvent,
  serializeGame,
  serializePlayer,
} from "../game/firestore.js";
import { prepareRateLimit } from "../security/rate-limit.js";

export const requestRematch = onCall(
  { region: "us-central1", cors: true },
  async (request) => {
    try {
      if (!request.auth) throw new Error("UNAUTHENTICATED");
      const uid = request.auth.uid;
      const { gameId, actionId } = gameActionSchema.parse(request.data);
      const newGameId = db.collection("games").doc().id;
      const roomCode = createRoomCode(randomBytes(12));
      const now = Date.now();
      return await db.runTransaction(async (transaction) => {
        const commitRateLimit = await prepareRateLimit(
          db,
          transaction,
          uid,
          now,
        );
        const oldRef = db.collection("games").doc(gameId);
        const oldSnapshot = await transaction.get(oldRef);
        if (!oldSnapshot.exists) throw new Error("GAME_NOT_FOUND");
        const old = oldSnapshot.data()!;
        if (old.player1Id !== uid && old.player2Id !== uid)
          throw new Error("NOT_A_PLAYER");
        if (old.rematchGameId)
          return {
            ready: true,
            gameId: String(old.rematchGameId),
            serverTime: now,
          };
        if (old.status !== "FINISHED") throw new Error("REMATCH_NOT_AVAILABLE");
        const playerIds = [String(old.player1Id), String(old.player2Id)];
        const playerRefs = playerIds.map((playerId) =>
          oldRef.collection("players").doc(playerId),
        );
        const requestRefs = playerIds.map((playerId) =>
          oldRef.collection("rematchRequests").doc(playerId),
        );
        const [
          playerOneSnapshot,
          playerTwoSnapshot,
          requestOne,
          requestTwo,
          roomSnapshot,
        ] = await Promise.all([
          transaction.get(playerRefs[0]!),
          transaction.get(playerRefs[1]!),
          transaction.get(requestRefs[0]!),
          transaction.get(requestRefs[1]!),
          transaction.get(db.collection("roomCodes").doc(roomCode)),
        ]);
        if (roomSnapshot.exists) throw new Error("ROOM_CODE_COLLISION");
        const ownIndex = playerIds.indexOf(uid);
        const otherRequest = ownIndex === 0 ? requestTwo : requestOne;
        const ownRequest = ownIndex === 0 ? requestOne : requestTwo;
        if (!otherRequest.exists) {
          if (!ownRequest.exists) {
            commitRateLimit();
            transaction.set(requestRefs[ownIndex]!, {
              actionId,
              requestedAt: Timestamp.fromMillis(now),
            });
          }
          return { ready: false, gameId: null, serverTime: now };
        }
        const oldPlayers = [playerOneSnapshot, playerTwoSnapshot].map(
          (snapshot) => {
            if (!snapshot.exists) throw new Error("PLAYER_NOT_FOUND");
            return deserializePlayer(snapshot.data()!);
          },
        );
        const resetPlayer = (value: PlayerState): PlayerState => ({
          ...value,
          ready: false,
          fleetConfirmed: false,
          joinedAt: now,
          stats: {
            attacks: 0,
            hits: 0,
            misses: 0,
            shipsSunk: 0,
            weaponsUsed: 0,
          },
        });
        const game: PublicGameState = {
          id: newGameId,
          roomCode,
          status: "PLACING_SHIPS",
          player1Id: playerIds[1]!,
          player2Id: playerIds[0]!,
          currentTurnPlayerId: null,
          turnNumber: 0,
          turnStartedAt: null,
          turnEndsAt: null,
          winnerId: null,
          rules: old.rules,
          createdAt: now,
          updatedAt: now,
          seriesId: String(old.seriesId),
        };
        const newRef = db.collection("games").doc(newGameId);
        commitRateLimit();
        transaction.create(newRef, serializeGame(game));
        transaction.create(db.collection("roomCodes").doc(roomCode), {
          gameId: newGameId,
          createdAt: Timestamp.fromMillis(now),
        });
        for (const value of oldPlayers.map(resetPlayer)) {
          transaction.set(
            newRef.collection("players").doc(value.uid),
            serializePlayer(value),
          );
          transaction.set(newRef.collection("publicBoards").doc(value.uid), {
            ownerId: value.uid,
            attackedCells: {},
          });
          transaction.set(db.collection("activeGames").doc(value.uid), {
            gameId: newGameId,
            updatedAt: Timestamp.fromMillis(now),
          });
        }
        transaction.update(oldRef, {
          rematchGameId: newGameId,
          updatedAt: Timestamp.fromMillis(now),
        });
        transaction.set(
          newRef.collection("events").doc(),
          serializeEvent({
            id: randomUUID(),
            type: "GAME_CREATED",
            actorId: uid,
            payload: { rematchOf: gameId },
            createdAt: now,
          }),
        );
        return { ready: true, gameId: newGameId, serverTime: now };
      });
    } catch (error) {
      return asHttpsError(error);
    }
  },
);

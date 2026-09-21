import { randomBytes, randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import {
  createRoomInputSchema,
  joinRoomInputSchema,
  leaveRoomInputSchema,
  type PlayerState,
  type PublicGameState,
  type WeaponInventory,
} from "@sea-battle/shared-types";
import { createRoomCode } from "@sea-battle/game-engine";
import { db } from "../firebase.js";
import { asHttpsError } from "../errors.js";
import { prepareRateLimit } from "../security/rate-limit.js";
import {
  serializeEvent,
  serializeGame,
  serializePlayer,
} from "../game/firestore.js";

const callableOptions = { region: "us-central1", cors: true } as const;

const requireUid = (auth: { uid: string } | undefined): string => {
  if (!auth) throw new Error("UNAUTHENTICATED");
  return auth.uid;
};

const initialInventory = (): WeaponInventory => ({
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
});

const player = (uid: string, name: string, now: number): PlayerState => ({
  uid,
  name,
  ready: false,
  fleetConfirmed: false,
  joinedAt: now,
  energy: 0,
  inventory: initialInventory(),
  stats: { attacks: 0, hits: 0, misses: 0, shipsSunk: 0, weaponsUsed: 0 },
});

export const createRoom = onCall(callableOptions, async (request) => {
  try {
    const uid = requireUid(request.auth);
    const input = createRoomInputSchema.parse(request.data);
    const now = Date.now();
    const gameId = db.collection("games").doc().id;
    const roomCode = createRoomCode(randomBytes(12));
    const seriesId = randomUUID();
    const game: PublicGameState = {
      id: gameId,
      roomCode,
      status: "WAITING_PLAYER",
      player1Id: uid,
      player2Id: null,
      currentTurnPlayerId: null,
      turnNumber: 0,
      turnStartedAt: null,
      turnEndsAt: null,
      winnerId: null,
      rules: { keepTurnOnHit: true, turnSeconds: 30 },
      createdAt: now,
      updatedAt: now,
      seriesId,
    };
    await db.runTransaction(async (transaction) => {
      const commitRateLimit = await prepareRateLimit(db, transaction, uid, now);
      const roomRef = db.collection("roomCodes").doc(roomCode);
      if ((await transaction.get(roomRef)).exists)
        throw new Error("ROOM_CODE_COLLISION");
      commitRateLimit();
      const gameRef = db.collection("games").doc(gameId);
      transaction.create(gameRef, serializeGame(game));
      transaction.create(roomRef, {
        gameId,
        createdAt: Timestamp.fromMillis(now),
      });
      transaction.set(
        gameRef.collection("players").doc(uid),
        serializePlayer(player(uid, input.playerName, now)),
      );
      transaction.set(gameRef.collection("publicBoards").doc(uid), {
        ownerId: uid,
        attackedCells: {},
      });
      transaction.set(db.collection("activeGames").doc(uid), {
        gameId,
        updatedAt: Timestamp.fromMillis(now),
      });
      transaction.set(
        gameRef.collection("events").doc(),
        serializeEvent({
          id: randomUUID(),
          type: "GAME_CREATED",
          actorId: uid,
          payload: {},
          createdAt: now,
        }),
      );
    });
    return { gameId, roomCode, serverTime: now };
  } catch (error) {
    return asHttpsError(error);
  }
});

export const joinRoom = onCall(callableOptions, async (request) => {
  try {
    const uid = requireUid(request.auth);
    const input = joinRoomInputSchema.parse(request.data);
    const now = Date.now();
    return await db.runTransaction(async (transaction) => {
      const commitRateLimit = await prepareRateLimit(db, transaction, uid, now);
      const roomSnapshot = await transaction.get(
        db.collection("roomCodes").doc(input.roomCode),
      );
      if (!roomSnapshot.exists) throw new Error("ROOM_NOT_FOUND");
      const gameId = String(roomSnapshot.get("gameId"));
      const gameRef = db.collection("games").doc(gameId);
      const gameSnapshot = await transaction.get(gameRef);
      if (!gameSnapshot.exists) throw new Error("GAME_NOT_FOUND");
      const game = gameSnapshot.data()!;
      if (game.player1Id === uid)
        return { gameId, roomCode: input.roomCode, serverTime: now };
      if (game.player2Id || game.status !== "WAITING_PLAYER")
        throw new Error("ROOM_FULL");
      commitRateLimit();
      transaction.update(gameRef, {
        player2Id: uid,
        status: "PLACING_SHIPS",
        updatedAt: Timestamp.fromMillis(now),
      });
      transaction.set(
        gameRef.collection("players").doc(uid),
        serializePlayer(player(uid, input.playerName, now)),
      );
      transaction.set(gameRef.collection("publicBoards").doc(uid), {
        ownerId: uid,
        attackedCells: {},
      });
      transaction.set(db.collection("activeGames").doc(uid), {
        gameId,
        updatedAt: Timestamp.fromMillis(now),
      });
      transaction.set(
        gameRef.collection("events").doc(),
        serializeEvent({
          id: randomUUID(),
          type: "PLAYER_JOINED",
          actorId: uid,
          payload: {},
          createdAt: now,
        }),
      );
      return { gameId, roomCode: input.roomCode, serverTime: now };
    });
  } catch (error) {
    return asHttpsError(error);
  }
});

export const leaveRoom = onCall(callableOptions, async (request) => {
  try {
    const uid = requireUid(request.auth);
    const { gameId } = leaveRoomInputSchema.parse(request.data);
    const now = Date.now();
    await db.runTransaction(async (transaction) => {
      const commitRateLimit = await prepareRateLimit(db, transaction, uid, now);
      const reference = db.collection("games").doc(gameId);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new Error("GAME_NOT_FOUND");
      const data = snapshot.data()!;
      if (data.player1Id !== uid && data.player2Id !== uid)
        throw new Error("NOT_A_PLAYER");
      commitRateLimit();
      if (data.status !== "FINISHED" && data.status !== "ABANDONED") {
        transaction.update(reference, {
          status: "ABANDONED",
          currentTurnPlayerId: null,
          turnEndsAt: null,
          updatedAt: Timestamp.fromMillis(now),
        });
      }
      transaction.delete(db.collection("activeGames").doc(uid));
    });
    return { ok: true };
  } catch (error) {
    return asHttpsError(error);
  }
});

export const syncGame = onCall(callableOptions, async (request) => {
  try {
    const uid = requireUid(request.auth);
    const gameId = String(request.data?.gameId ?? "");
    if (!gameId) {
      const active = await db.collection("activeGames").doc(uid).get();
      return {
        gameId: active.exists ? String(active.get("gameId")) : null,
        serverTime: Date.now(),
      };
    }
    const game = await db.collection("games").doc(gameId).get();
    if (!game.exists) throw new Error("GAME_NOT_FOUND");
    if (game.get("player1Id") !== uid && game.get("player2Id") !== uid)
      throw new Error("NOT_A_PLAYER");
    const [board, player] = await Promise.all([
      db
        .collection("privateGameData")
        .doc(gameId)
        .collection("boards")
        .doc(uid)
        .get(),
      db.collection("games").doc(gameId).collection("players").doc(uid).get(),
    ]);
    return {
      gameId,
      serverTime: Date.now(),
      ownFleet: board.exists ? board.get("ships") : [],
      player: player.exists ? player.data() : null,
    };
  } catch (error) {
    return asHttpsError(error);
  }
});

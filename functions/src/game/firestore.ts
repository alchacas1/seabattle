import {
  Timestamp,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import type {
  GameEvent,
  PlayerState,
  PublicBoard,
  PublicGameState,
} from "@sea-battle/shared-types";
import type { GameAggregate, PrivateBoard, ProcessedAction } from "./models.js";

const millis = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  throw new Error("Invalid timestamp value");
};

export function deserializeGame(
  id: string,
  raw: Record<string, unknown>,
): PublicGameState {
  return {
    ...(raw as unknown as PublicGameState),
    id,
    createdAt: millis(raw.createdAt) ?? 0,
    updatedAt: millis(raw.updatedAt) ?? 0,
    turnStartedAt: millis(raw.turnStartedAt),
    turnEndsAt: millis(raw.turnEndsAt),
  };
}

export function serializeGame(game: PublicGameState): Record<string, unknown> {
  const { id: _id, ...data } = game;
  return {
    ...data,
    createdAt: Timestamp.fromMillis(game.createdAt),
    updatedAt: Timestamp.fromMillis(game.updatedAt),
    turnStartedAt:
      game.turnStartedAt === null
        ? null
        : Timestamp.fromMillis(game.turnStartedAt),
    turnEndsAt:
      game.turnEndsAt === null ? null : Timestamp.fromMillis(game.turnEndsAt),
  };
}

export function serializePlayer(player: PlayerState): Record<string, unknown> {
  return { ...player, joinedAt: Timestamp.fromMillis(player.joinedAt) };
}

export function deserializePlayer(raw: Record<string, unknown>): PlayerState {
  return {
    ...(raw as unknown as PlayerState),
    joinedAt: millis(raw.joinedAt) ?? 0,
  };
}

export async function loadAggregate(
  firestore: Firestore,
  transaction: Transaction,
  gameId: string,
  actionId?: string,
): Promise<GameAggregate> {
  const gameRef = firestore.collection("games").doc(gameId);
  const gameSnapshot = await transaction.get(gameRef);
  if (!gameSnapshot.exists) throw new Error("GAME_NOT_FOUND");
  const game = deserializeGame(gameId, gameSnapshot.data()!);
  const playerIds = [game.player1Id, game.player2Id].filter(
    (id): id is string => Boolean(id),
  );
  const refs = playerIds.flatMap((uid) => [
    gameRef.collection("players").doc(uid),
    gameRef.collection("publicBoards").doc(uid),
    firestore
      .collection("privateGameData")
      .doc(gameId)
      .collection("boards")
      .doc(uid),
  ]);
  const actionRef = actionId
    ? gameRef.collection("actions").doc(actionId)
    : null;
  const snapshots = refs.length > 0 ? await transaction.getAll(...refs) : [];
  const actionSnapshot = actionRef ? await transaction.get(actionRef) : null;

  const players: Record<string, PlayerState> = {};
  const publicBoards: Record<string, PublicBoard> = {};
  const privateBoards: Record<string, PrivateBoard> = {};
  playerIds.forEach((uid, index) => {
    const player = snapshots[index * 3];
    const publicBoard = snapshots[index * 3 + 1];
    const privateBoard = snapshots[index * 3 + 2];
    if (player?.exists) players[uid] = deserializePlayer(player.data()!);
    if (publicBoard?.exists)
      publicBoards[uid] = publicBoard.data() as PublicBoard;
    if (privateBoard?.exists)
      privateBoards[uid] = privateBoard.data() as PrivateBoard;
  });
  const processedActions: Record<string, ProcessedAction> = {};
  if (actionId && actionSnapshot?.exists)
    processedActions[actionId] = actionSnapshot.data() as ProcessedAction;
  return {
    game,
    players,
    publicBoards,
    privateBoards,
    processedActions,
    events: [],
  };
}

export function persistAggregate(
  firestore: Firestore,
  transaction: Transaction,
  aggregate: GameAggregate,
  actionId?: string,
): void {
  const gameRef = firestore.collection("games").doc(aggregate.game.id);
  transaction.set(gameRef, serializeGame(aggregate.game));
  Object.values(aggregate.players).forEach((player) => {
    transaction.set(
      gameRef.collection("players").doc(player.uid),
      serializePlayer(player),
    );
  });
  Object.entries(aggregate.publicBoards).forEach(([uid, board]) => {
    if (board)
      transaction.set(gameRef.collection("publicBoards").doc(uid), board);
  });
  Object.entries(aggregate.privateBoards).forEach(([uid, board]) => {
    if (board)
      transaction.set(
        firestore
          .collection("privateGameData")
          .doc(aggregate.game.id)
          .collection("boards")
          .doc(uid),
        board,
      );
  });
  if (actionId) {
    const action = aggregate.processedActions[actionId];
    if (action)
      transaction.set(gameRef.collection("actions").doc(actionId), action);
  }
  for (const gameEvent of aggregate.events ?? []) {
    const eventRef = gameRef.collection("events").doc(gameEvent.id);
    transaction.set(eventRef, serializeEvent(gameEvent));
  }
}

export function serializeEvent(gameEvent: GameEvent): Record<string, unknown> {
  return { ...gameEvent, createdAt: Timestamp.fromMillis(gameEvent.createdAt) };
}

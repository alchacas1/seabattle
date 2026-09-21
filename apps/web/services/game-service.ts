"use client";

import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";
import type {
  AttackInput,
  AttackResult,
  Coordinate,
  GameEvent,
  PlayerState,
  PublicBoard,
  PublicGameState,
  Ship,
} from "@sea-battle/shared-types";
import { auth, firestore, functions, realtime } from "@/lib/firebase";

const toMillis = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  )
    return value.toMillis();
  return null;
};

const mapGame = (id: string, data: DocumentData): PublicGameState => ({
  ...(data as PublicGameState),
  id,
  createdAt: toMillis(data.createdAt) ?? 0,
  updatedAt: toMillis(data.updatedAt) ?? 0,
  turnStartedAt: toMillis(data.turnStartedAt),
  turnEndsAt: toMillis(data.turnEndsAt),
});

export interface GameSnapshotHandlers {
  game: (game: PublicGameState | null) => void;
  players: (players: Record<string, PlayerState>) => void;
  boards: (boards: Record<string, PublicBoard>) => void;
  events: (events: GameEvent[]) => void;
  error: (error: Error) => void;
}

export function ensureAnonymousAuth(
  onUser: (user: User) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onAuthStateChanged(
    auth,
    (user) => {
      if (user) onUser(user);
      else signInAnonymously(auth).catch(onError);
    },
    onError,
  );
}

export async function createRoom(playerName: string) {
  return (
    await httpsCallable<
      { playerName: string },
      { gameId: string; roomCode: string; serverTime: number }
    >(
      functions,
      "createRoom",
    )({ playerName })
  ).data;
}

export async function joinRoom(playerName: string, roomCode: string) {
  return (
    await httpsCallable<
      { playerName: string; roomCode: string },
      { gameId: string; roomCode: string; serverTime: number }
    >(
      functions,
      "joinRoom",
    )({ playerName, roomCode })
  ).data;
}

export async function getAutoFleet(gameId: string): Promise<Ship[]> {
  const response = await httpsCallable<{ gameId: string }, { fleet: Ship[] }>(
    functions,
    "autoPlaceFleet",
  )({ gameId });
  return response.data.fleet;
}

export async function confirmFleet(gameId: string, fleet: Ship[]) {
  return (
    await httpsCallable(
      functions,
      "confirmFleet",
    )({ gameId, fleet, actionId: crypto.randomUUID() })
  ).data;
}

export async function attackCell(
  gameId: string,
  coordinate: Coordinate,
): Promise<{ result: AttackResult }> {
  const payload: AttackInput = {
    gameId,
    ...coordinate,
    actionId: crypto.randomUUID(),
  };
  return (
    await httpsCallable<AttackInput, { result: AttackResult }>(
      functions,
      "attack",
    )(payload)
  ).data;
}

export async function leaveRoom(gameId: string): Promise<void> {
  await httpsCallable(functions, "leaveRoom")({ gameId });
}

export async function requestRematch(
  gameId: string,
): Promise<{ ready: boolean; gameId: string | null; serverTime: number }> {
  return (
    await httpsCallable(
      functions,
      "requestRematch",
    )({ gameId, actionId: crypto.randomUUID() })
  ).data as never;
}

export async function syncGame(gameId?: string): Promise<{
  gameId: string | null;
  serverTime: number;
  ownFleet?: Ship[];
  player?: PlayerState | null;
}> {
  return (
    await httpsCallable(
      functions,
      "syncGame",
    )({ ...(gameId ? { gameId } : {}) })
  ).data as never;
}

export function subscribeToGame(
  gameId: string,
  handlers: GameSnapshotHandlers,
): Unsubscribe {
  const gameRef = doc(firestore, "games", gameId);
  const unsubscribers = [
    onSnapshot(
      gameRef,
      (snapshot) =>
        handlers.game(
          snapshot.exists() ? mapGame(snapshot.id, snapshot.data()) : null,
        ),
      handlers.error,
    ),
    onSnapshot(
      collection(gameRef, "players"),
      (snapshot) => {
        handlers.players(
          Object.fromEntries(
            snapshot.docs.map((item) => [
              item.id,
              {
                ...item.data(),
                joinedAt: toMillis(item.get("joinedAt")) ?? 0,
              } as PlayerState,
            ]),
          ),
        );
      },
      handlers.error,
    ),
    onSnapshot(
      collection(gameRef, "publicBoards"),
      (snapshot) => {
        handlers.boards(
          Object.fromEntries(
            snapshot.docs.map((item) => [item.id, item.data() as PublicBoard]),
          ),
        );
      },
      handlers.error,
    ),
    onSnapshot(
      query(
        collection(gameRef, "events"),
        orderBy("createdAt", "desc"),
        limit(30),
      ),
      (snapshot) => {
        handlers.events(
          snapshot.docs.map(
            (item) =>
              ({
                ...item.data(),
                id: item.id,
                createdAt: toMillis(item.get("createdAt")) ?? 0,
              }) as GameEvent,
          ),
        );
      },
      handlers.error,
    ),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export function trackPresence(
  uid: string,
  gameId: string | null,
  onConnected: (connected: boolean) => void,
): Unsubscribe {
  const connectedRef = ref(realtime, ".info/connected");
  const presenceRef = ref(realtime, `presence/${uid}`);
  return onValue(connectedRef, async (snapshot) => {
    const connected = snapshot.val() === true;
    onConnected(connected);
    if (!connected) return;
    await onDisconnect(presenceRef).set({
      online: false,
      gameId,
      lastSeen: serverTimestamp(),
    });
    await set(presenceRef, {
      online: true,
      gameId,
      lastSeen: serverTimestamp(),
    });
  });
}

export function subscribePresence(
  uid: string,
  callback: (online: boolean) => void,
): Unsubscribe {
  return onValue(ref(realtime, `presence/${uid}`), (snapshot) =>
    callback(snapshot.val()?.online === true),
  );
}

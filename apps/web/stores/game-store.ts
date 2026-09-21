"use client";

import { create } from "zustand";
import type {
  GameEvent,
  PlayerState,
  PublicBoard,
  PublicGameState,
  Ship,
} from "@sea-battle/shared-types";

interface GameStore {
  uid: string | null;
  gameId: string | null;
  resumableGameId: string | null;
  game: PublicGameState | null;
  players: Record<string, PlayerState>;
  boards: Record<string, PublicBoard>;
  events: GameEvent[];
  ownFleet: Ship[];
  serverOffset: number;
  connected: boolean;
  rivalOnline: boolean | null;
  setUid: (uid: string) => void;
  setGameId: (gameId: string | null) => void;
  setResumableGameId: (gameId: string | null) => void;
  setGame: (game: PublicGameState | null) => void;
  setPlayers: (players: Record<string, PlayerState>) => void;
  setBoards: (boards: Record<string, PublicBoard>) => void;
  setEvents: (events: GameEvent[]) => void;
  setOwnFleet: (fleet: Ship[]) => void;
  setServerTime: (serverTime: number) => void;
  setConnected: (connected: boolean) => void;
  setRivalOnline: (online: boolean | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  uid: null,
  gameId: null,
  resumableGameId: null,
  game: null,
  players: {},
  boards: {},
  events: [],
  ownFleet: [],
  serverOffset: 0,
  connected: true,
  rivalOnline: null,
  setUid: (uid) => set({ uid }),
  setGameId: (gameId) => set({ gameId }),
  setResumableGameId: (resumableGameId) => set({ resumableGameId }),
  setGame: (game) => set({ game }),
  setPlayers: (players) => set({ players }),
  setBoards: (boards) => set({ boards }),
  setEvents: (events) => set({ events }),
  setOwnFleet: (ownFleet) => set({ ownFleet }),
  setServerTime: (serverTime) => set({ serverOffset: serverTime - Date.now() }),
  setConnected: (connected) => set({ connected }),
  setRivalOnline: (rivalOnline) => set({ rivalOnline }),
  reset: () =>
    set({
      gameId: null,
      game: null,
      players: {},
      boards: {},
      events: [],
      ownFleet: [],
      rivalOnline: null,
    }),
}));

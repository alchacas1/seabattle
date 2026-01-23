import { create } from 'zustand';
import type { CellState, Direction, ShipKind } from '../game/types';
import { FLEET_KINDS, SHIP_SPECS } from '../game/types';
import { createBoard } from '../game/board';

type Phase = 'lobby' | 'placing' | 'playing' | 'finished';

type Toast = { id: string; message: string };

export type PublicPlayer = { id: string; name: string };

type GameState = {
  phase: Phase;
  playerId: string | null;
  playerName: string;
  gameId: string | null;
  role: 'p1' | 'p2' | null;
  opponentJoined: boolean;
  players: PublicPlayer[];
  readyPlayers: Record<string, boolean>;
  currentTurn: string | null;
  winnerId: string | null;

  myBoard: CellState[][];
  enemyBoardView: CellState[][]; // only hit/miss knowledge

  lastSunkShipId: string | null;
  toasts: Toast[];

  // placement UI
  placementDirection: Direction;
  selectedShipKind: ShipKind | null;
  placedKinds: Record<ShipKind, boolean>;

  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setGame: (gameId: string, role: 'p1' | 'p2') => void;
  setPhase: (phase: Phase) => void;
  setOpponentJoined: (v: boolean) => void;
  setPlayers: (players: PublicPlayer[]) => void;
  markReady: (playerId: string) => void;
  setCurrentTurn: (playerId: string) => void;
  applyShotResult: (payload: {
    by: string;
    at: { x: number; y: number };
    result: 'hit' | 'miss';
    sunkShipId?: string;
    gameOver?: boolean;
    winnerId?: string;
  }) => void;

  resetBoards: () => void;
  resetPlacementState: () => void;
  selectShipKind: (kind: ShipKind) => void;
  togglePlacementDirection: () => void;
  markKindPlaced: (kind: ShipKind) => void;
  placeShipLocally: (kind: ShipKind, start: { x: number; y: number }, direction: Direction) => void;
  addToast: (message: string) => void;
  clearToasts: () => void;
};

function safeSetCell(board: CellState[][], x: number, y: number, value: CellState) {
  if (!board[y] || board[y][x] === undefined) return;
  board[y][x] = value;
}

function createPlacedKinds(): Record<ShipKind, boolean> {
  return Object.fromEntries(FLEET_KINDS.map((k) => [k, false])) as Record<ShipKind, boolean>;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'lobby',
  playerId: null,
  playerName: (localStorage.getItem('seabattle:name') ?? 'Jugador').slice(0, 18),
  gameId: null,
  role: null,
  opponentJoined: false,
  players: [],
  readyPlayers: {},
  currentTurn: null,
  winnerId: null,

  myBoard: createBoard('empty'),
  enemyBoardView: createBoard('empty'),

  lastSunkShipId: null,
  toasts: [],

  placementDirection: 'horizontal',
  selectedShipKind: FLEET_KINDS[0],
  placedKinds: createPlacedKinds(),

  setPlayerId: (id) => set({ playerId: id }),
  setPlayerName: (name) => {
    const normalized = name.trim().slice(0, 18) || 'Jugador';
    localStorage.setItem('seabattle:name', normalized);
    set({ playerName: normalized });
  },
  setGame: (gameId, role) => set({ gameId, role }),
  setPhase: (phase) => set({ phase }),
  setOpponentJoined: (v) => set({ opponentJoined: v }),
  setPlayers: (players) => set({ players }),
  markReady: (playerId) => set((s) => ({ readyPlayers: { ...s.readyPlayers, [playerId]: true } })),
  setCurrentTurn: (playerId) => set({ currentTurn: playerId }),

  resetBoards: () => set({ myBoard: createBoard('empty'), enemyBoardView: createBoard('empty') }),

  resetPlacementState: () =>
    set({
      placementDirection: 'horizontal',
      selectedShipKind: FLEET_KINDS[0],
      placedKinds: createPlacedKinds(),
    }),

  selectShipKind: (kind) => set({ selectedShipKind: kind }),
  togglePlacementDirection: () =>
    set((s) => ({ placementDirection: s.placementDirection === 'horizontal' ? 'vertical' : 'horizontal' })),
  markKindPlaced: (kind) => set((s) => ({ placedKinds: { ...s.placedKinds, [kind]: true } })),

  placeShipLocally: (kind, start, direction) => {
    const { myBoard } = get();
    const next = myBoard.map((row) => row.slice());

    const size = SHIP_SPECS[kind].size;
    for (let i = 0; i < size; i++) {
      const x = direction === 'horizontal' ? start.x + i : start.x;
      const y = direction === 'vertical' ? start.y + i : start.y;
      safeSetCell(next, x, y, 'ship');
    }

    set({ myBoard: next });
  },

  applyShotResult: (payload) => {
    const me = get().playerId;
    if (!me) return;

    const isMine = payload.by === me;
    if (isMine) {
      set((s) => {
        const next = s.enemyBoardView.map((row) => row.slice());
        safeSetCell(next, payload.at.x, payload.at.y, payload.result === 'hit' ? 'hit' : 'miss');
        return { enemyBoardView: next };
      });

      if (payload.sunkShipId) get().addToast(`Hundiste un barco (${payload.sunkShipId}).`);
    } else {
      set((s) => {
        const next = s.myBoard.map((row) => row.slice());
        safeSetCell(next, payload.at.x, payload.at.y, payload.result === 'hit' ? 'hit' : 'miss');
        return { myBoard: next };
      });

      if (payload.sunkShipId) get().addToast(`Te hundieron un barco (${payload.sunkShipId}).`);
    }

    if (payload.gameOver) {
      set({ phase: 'finished', winnerId: payload.winnerId ?? null });
    }
  },

  addToast: (message) =>
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID(), message }].slice(-3),
    })),

  clearToasts: () => set({ toasts: [] }),
}));

import { create } from 'zustand';
import type { CellState, Direction, ShipKind } from '../game/types';
import { FLEET_KINDS, SHIP_SPECS } from '../game/types';
import { createBoard, inBounds } from '../game/board';

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
  setCurrentTurn: (playerId: string | null) => void;
  applyShotResult: (payload: {
    by: string;
    at: { x: number; y: number };
    result: 'hit' | 'miss';
    sunkShipId?: string;
    gameOver?: boolean;
    winnerId?: string;
  }) => void;

  resetBoards: () => void;
  setBoards: (myBoard: CellState[][], enemyBoardView: CellState[][]) => void;
  resetPlacementState: () => void;
  setPlacedKinds: (placed: ShipKind[]) => void;
  setReadyPlayers: (readyPlayers: Record<string, boolean>) => void;
  setWinnerId: (winnerId: string | null) => void;
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

function markConnectedHitsAsSunk(board: CellState[][], startX: number, startY: number) {
  const start = board[startY]?.[startX];
  if (start !== 'hit' && start !== 'sunk') return;

  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  const visited = new Set<string>();

  while (queue.length) {
    const cur = queue.shift()!;
    const key = `${cur.x},${cur.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (!inBounds(cur.x, cur.y)) continue;
    const state = board[cur.y]?.[cur.x];
    if (state !== 'hit' && state !== 'sunk') continue;

    board[cur.y][cur.x] = 'sunk';

    queue.push({ x: cur.x + 1, y: cur.y });
    queue.push({ x: cur.x - 1, y: cur.y });
    queue.push({ x: cur.x, y: cur.y + 1 });
    queue.push({ x: cur.x, y: cur.y - 1 });
  }
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

  setBoards: (myBoard, enemyBoardView) => set({ myBoard, enemyBoardView }),

  resetPlacementState: () =>
    set({
      placementDirection: 'horizontal',
      selectedShipKind: FLEET_KINDS[0],
      placedKinds: createPlacedKinds(),
    }),

  setPlacedKinds: (placed) =>
    set(() => {
      const next = createPlacedKinds();
      for (const k of placed) next[k] = true;
      const selected = FLEET_KINDS.find((k) => !next[k]) ?? null;
      return { placedKinds: next, selectedShipKind: selected };
    }),

  setReadyPlayers: (readyPlayers) => set({ readyPlayers }),
  setWinnerId: (winnerId) => set({ winnerId }),

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

        if (payload.result === 'hit' && payload.sunkShipId) {
          markConnectedHitsAsSunk(next, payload.at.x, payload.at.y);
        }
        return { enemyBoardView: next };
      });

      if (payload.sunkShipId) get().addToast(`Hundiste un barco (${payload.sunkShipId}).`);
    } else {
      set((s) => {
        const next = s.myBoard.map((row) => row.slice());
        safeSetCell(next, payload.at.x, payload.at.y, payload.result === 'hit' ? 'hit' : 'miss');

        if (payload.result === 'hit' && payload.sunkShipId) {
          markConnectedHitsAsSunk(next, payload.at.x, payload.at.y);
        }
        return { myBoard: next };
      });

      if (payload.sunkShipId) get().addToast(`Te hundieron un barco (${payload.sunkShipId}).`);
    }

    if (payload.gameOver) {
      set({ phase: 'finished', winnerId: payload.winnerId ?? null });
    }
  },

  addToast: (message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message }].slice(-3) }));

    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2000);
  },

  clearToasts: () => set({ toasts: [] }),
}));

import { io, type Socket } from 'socket.io-client';

export type ServerToClientEvents = {
  connected: (payload: { playerId: string }) => void;
  gameCreated: (payload: { gameId: string }) => void;
  gameJoined: (payload: { gameId: string; youAre: 'p1' | 'p2' }) => void;
  playerJoined: (payload: { playerId: string }) => void;
  playersUpdated: (payload: { players: Array<{ id: string; name: string }> }) => void;
  placementUpdated: (payload: { ok: true } | { ok: false; reason: string }) => void;
  playerReady: (payload: { playerId: string }) => void;
  gameStarted: (payload: { currentTurn: string }) => void;
  shotResult: (payload: {
    by: string;
    at: { x: number; y: number };
    result: 'hit' | 'miss';
    sunkShipId?: string;
    gameOver?: boolean;
    winnerId?: string;
  }) => void;
  turnChanged: (payload: { currentTurn: string }) => void;
  error: (payload: { message: string }) => void;
};

export type ClientToServerEvents = {
  setName: (payload: { name: string }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
  createGame: (payload: { name: string }, ack?: (payload: { gameId: string }) => void) => void;
  joinGame: (payload: { gameId: string; name: string }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
  resetPlacement: (payload: { gameId: string }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
  placeShip: (
    payload: { gameId: string; kind: string; start: { x: number; y: number }; direction: 'horizontal' | 'vertical' },
    ack?: (payload: { ok: true } | { ok: false; reason: string }) => void,
  ) => void;
  setReady: (payload: { gameId: string }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
  shoot: (payload: { gameId: string; x: number; y: number }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) return socket;
  const url = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001';
  socket = io(url, { transports: ['websocket'] });
  return socket;
}

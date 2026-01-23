import type { Server as IOServer, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import type { Game } from '../game/types';
import { createGame, joinGame, placeShipForPlayer, resetPlacements, setPlayerReady, performShot, getOpponent } from '../game/game.logic';
import type { Direction, ShipKind } from '../game/types';

type ServerToClientEvents = {
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

type ClientToServerEvents = {
  setName: (payload: { name: string }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
  createGame: (payload: { name: string }, ack?: (payload: { gameId: string }) => void) => void;
  joinGame: (
    payload: { gameId: string; name: string },
    ack?: (payload: { ok: true } | { ok: false; reason: string }) => void,
  ) => void;
  resetPlacement: (payload: { gameId: string }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
  placeShip: (
    payload: {
    gameId: string;
    kind: ShipKind;
    start: { x: number; y: number };
    direction: Direction;
    },
    ack?: (payload: { ok: true } | { ok: false; reason: string }) => void,
  ) => void;
  setReady: (payload: { gameId: string }, ack?: (payload: { ok: true } | { ok: false; reason: string }) => void) => void;
  shoot: (
    payload: { gameId: string; x: number; y: number },
    ack?: (payload: { ok: true } | { ok: false; reason: string }) => void,
  ) => void;
};

type SocketData = {
  playerId: string;
  playerName: string;
  gameId?: string;
};

export type SeaBattleSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const games = new Map<string, Game>();

function normalizeName(name: string): string {
  const trimmed = name.trim().slice(0, 18);
  return trimmed.length > 0 ? trimmed : 'Jugador';
}

function emitPlayers(io: IOServer<ClientToServerEvents, ServerToClientEvents>, gameId: string) {
  const g = games.get(gameId);
  if (!g) return;
  const players = g.players
    .filter((p) => p.id)
    .map((p) => ({ id: p.id, name: p.name || 'Jugador' }));
  io.to(roomId(gameId)).emit('playersUpdated', { players });
}

function getGameOrThrow(gameId: string): Game {
  const g = games.get(gameId);
  if (!g) throw new Error('game_not_found');
  return g;
}

function roomId(gameId: string): string {
  return `game:${gameId}`;
}

export function attachSocketHandlers(io: IOServer<ClientToServerEvents, ServerToClientEvents>, socket: SeaBattleSocket) {
  const playerId = randomUUID();
  socket.data.playerId = playerId;
  socket.data.playerName = 'Jugador';
  socket.emit('connected', { playerId });

  socket.on('setName', ({ name }, ack) => {
    try {
      socket.data.playerName = normalizeName(name);
      const gid = socket.data.gameId;
      if (gid) {
        const g = getGameOrThrow(gid);
        const p = g.players.find((pl) => pl.id === playerId);
        if (p) p.name = socket.data.playerName;
        emitPlayers(io, gid);
      }
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, reason: (e as Error).message });
    }
  });

  socket.on('createGame', ({ name }, ack) => {
    socket.data.playerName = normalizeName(name);
    const g = createGame(playerId, socket.data.playerName);
    games.set(g.id, g);
    void socket.join(roomId(g.id));
    socket.data.gameId = g.id;
    socket.emit('gameCreated', { gameId: g.id });
    socket.emit('gameJoined', { gameId: g.id, youAre: 'p1' });
    emitPlayers(io, g.id);
    ack?.({ gameId: g.id });
  });

  socket.on('joinGame', ({ gameId, name }, ack) => {
    try {
      const g = getGameOrThrow(gameId);
      socket.data.playerName = normalizeName(name);
      joinGame(g, playerId, socket.data.playerName);
      void socket.join(roomId(gameId));
      socket.data.gameId = gameId;

      socket.emit('gameJoined', { gameId, youAre: 'p2' });
      socket.to(roomId(gameId)).emit('playerJoined', { playerId });
      emitPlayers(io, gameId);
      ack?.({ ok: true });
    } catch (e) {
      socket.emit('error', { message: (e as Error).message });
      ack?.({ ok: false, reason: (e as Error).message });
    }
  });

  socket.on('resetPlacement', ({ gameId }, ack) => {
    try {
      const g = getGameOrThrow(gameId);
      resetPlacements(g, playerId);
      io.to(roomId(gameId)).emit('placementUpdated', { ok: true });
      ack?.({ ok: true });
    } catch (e) {
      socket.emit('placementUpdated', { ok: false, reason: (e as Error).message });
      ack?.({ ok: false, reason: (e as Error).message });
    }
  });

  socket.on('placeShip', ({ gameId, kind, start, direction }, ack) => {
    try {
      const g = getGameOrThrow(gameId);
      const res = placeShipForPlayer(g, playerId, { kind, start, direction });
      io.to(roomId(gameId)).emit('placementUpdated', res);
      ack?.(res);
    } catch (e) {
      const res = { ok: false as const, reason: (e as Error).message };
      socket.emit('placementUpdated', res);
      ack?.(res);
    }
  });

  socket.on('setReady', ({ gameId }, ack) => {
    try {
      const g = getGameOrThrow(gameId);
      const res = setPlayerReady(g, playerId);
      if (!res.ok) {
        socket.emit('error', { message: res.reason });
        ack?.({ ok: false, reason: res.reason });
        return;
      }

      io.to(roomId(gameId)).emit('playerReady', { playerId });
      if (g.status === 'playing') {
        io.to(roomId(gameId)).emit('gameStarted', { currentTurn: g.currentTurn });
        io.to(roomId(gameId)).emit('turnChanged', { currentTurn: g.currentTurn });
      }

      ack?.({ ok: true });
    } catch (e) {
      socket.emit('error', { message: (e as Error).message });
      ack?.({ ok: false, reason: (e as Error).message });
    }
  });

  socket.on('shoot', ({ gameId, x, y }, ack) => {
    try {
      const g = getGameOrThrow(gameId);
      const shot = performShot(g, playerId, x, y);
      io.to(roomId(gameId)).emit('shotResult', {
        by: playerId,
        at: { x, y },
        result: shot.type,
        sunkShipId: shot.sunkShipId,
        gameOver: shot.gameOver,
        winnerId: shot.winnerId,
      });

      if (!shot.gameOver && shot.type === 'miss') {
        io.to(roomId(gameId)).emit('turnChanged', { currentTurn: g.currentTurn });
      }

      if (shot.gameOver) {
        // optional: keep game around for inspection
      } else {
        // On hit: no turn change in our rules.
      }

      // Defensive: ensure opponent exists and is in room (no-op)
      void getOpponent(g, playerId);

      ack?.({ ok: true });
    } catch (e) {
      socket.emit('error', { message: (e as Error).message });
      ack?.({ ok: false, reason: (e as Error).message });
    }
  });
}

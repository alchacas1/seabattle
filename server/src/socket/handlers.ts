import type { Server as IOServer, Socket } from 'socket.io';
import { randomUUID } from 'crypto';
import type { Game } from '../game/types';
import { createGame, joinGame, placeShipForPlayer, resetPlacements, setPlayerReady, performShot, getOpponent, getPlayer } from '../game/game.logic';
import type { CellState, Direction, ShipKind } from '../game/types';
import { FLEET_KINDS } from '../game/types';

type ServerToClientEvents = {
  connected: (payload: { playerId: string }) => void;
  gameCreated: (payload: { gameId: string }) => void;
  gameJoined: (payload: { gameId: string; youAre: 'p1' | 'p2' }) => void;
  gameState: (payload: {
    gameId: string;
    youAre: 'p1' | 'p2';
    status: 'waiting' | 'placing' | 'playing' | 'finished';
    players: Array<{ id: string; name: string }>;
    readyPlayers: Record<string, boolean>;
    currentTurn?: string;
    winnerId?: string;
    myBoard: CellState[][];
    enemyBoardView: CellState[][];
    placedKinds: ShipKind[];
  }) => void;
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
const playerSockets = new Map<string, string>(); // playerId -> socket.id

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

function boardToMatrix(board: Array<Array<{ state: CellState }>>, revealShips: boolean): CellState[][] {
  return board.map((row) =>
    row.map((cell) => {
      if (!revealShips && cell.state === 'ship') return 'empty';
      return cell.state;
    }),
  );
}

function getRole(game: Game, playerId: string): 'p1' | 'p2' {
  return game.players[0].id === playerId ? 'p1' : 'p2';
}

function emitGameStateToSocket(socket: SeaBattleSocket, game: Game, playerId: string) {
  const me = getPlayer(game, playerId);
  const opp = getOpponent(game, playerId);

  const players = game.players.filter((p) => p.id).map((p) => ({ id: p.id, name: p.name || 'Jugador' }));
  const readyPlayers: Record<string, boolean> = {};
  for (const p of game.players) {
    if (!p.id) continue;
    readyPlayers[p.id] = !!p.ready;
  }

  socket.emit('gameState', {
    gameId: game.id,
    youAre: getRole(game, playerId),
    status: game.status,
    players,
    readyPlayers,
    currentTurn: game.currentTurn || undefined,
    winnerId: game.winnerId,
    myBoard: boardToMatrix(me.board, true),
    enemyBoardView: boardToMatrix(opp.board, false),
    placedKinds: me.ships.map((s) => s.kind),
  });
}

function normalizeOrThrow(name: string): string {
  const n = normalizeName(name);
  if (!n.trim()) throw new Error('invalid_name');
  return n;
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
  socket.data.playerId = randomUUID();
  socket.data.playerName = 'Jugador';
  socket.emit('connected', { playerId: socket.data.playerId });

  socket.on('disconnect', () => {
    const pid = socket.data.playerId;
    if (playerSockets.get(pid) === socket.id) playerSockets.delete(pid);
  });

  socket.on('setName', ({ name }, ack) => {
    try {
      socket.data.playerName = normalizeName(name);
      const gid = socket.data.gameId;
      if (gid) {
        const g = getGameOrThrow(gid);
        const p = g.players.find((pl) => pl.id === socket.data.playerId);
        if (p) p.name = socket.data.playerName;
        emitPlayers(io, gid);
      }
      ack?.({ ok: true });
    } catch (e) {
      ack?.({ ok: false, reason: (e as Error).message });
    }
  });

  socket.on('createGame', ({ name }, ack) => {
    socket.data.playerName = normalizeOrThrow(name);
    const pid = socket.data.playerId;
    const g = createGame(pid, socket.data.playerName);
    games.set(g.id, g);
    void socket.join(roomId(g.id));
    socket.data.gameId = g.id;
    playerSockets.set(pid, socket.id);
    socket.emit('gameCreated', { gameId: g.id });
    socket.emit('gameJoined', { gameId: g.id, youAre: 'p1' });
    emitPlayers(io, g.id);
    emitGameStateToSocket(socket, g, pid);
    ack?.({ gameId: g.id });
  });

  socket.on('joinGame', ({ gameId, name }, ack) => {
    try {
      const g = getGameOrThrow(gameId);
      const normalizedName = normalizeOrThrow(name);
      socket.data.playerName = normalizedName;

      // Rejoin-by-name: if a player with that name exists, bind this socket to that player.
      const existing = g.players.find((p) => p.id && p.name === normalizedName);
      let assignedPlayerId = socket.data.playerId;
      if (existing) {
        const currentSocketId = playerSockets.get(existing.id);
        if (currentSocketId && currentSocketId !== socket.id) {
          throw new Error('name_in_use');
        }
        assignedPlayerId = existing.id;
      }

      // If not resuming, attempt a normal join (p2) using this socket's playerId.
      if (!existing) {
        joinGame(g, assignedPlayerId, socket.data.playerName);
      }

      socket.data.playerId = assignedPlayerId;
      void socket.join(roomId(gameId));
      socket.data.gameId = gameId;

      playerSockets.set(assignedPlayerId, socket.id);

      // Ensure client uses the authoritative playerId (important on resume).
      socket.emit('connected', { playerId: assignedPlayerId });

      const youAre = getRole(g, assignedPlayerId);
      socket.emit('gameJoined', { gameId, youAre });

      emitGameStateToSocket(socket, g, assignedPlayerId);

      // Notify the opponent and refresh their snapshot too.
      const opponent = getOpponent(g, assignedPlayerId);
      const oppSocketId = opponent.id ? playerSockets.get(opponent.id) : undefined;
      if (oppSocketId) {
        io.to(oppSocketId).emit('playerJoined', { playerId: assignedPlayerId });
        const oppSocket = io.sockets.sockets.get(oppSocketId) as SeaBattleSocket | undefined;
        if (oppSocket) emitGameStateToSocket(oppSocket, g, opponent.id);
      }
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
      resetPlacements(g, socket.data.playerId);
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
      const res = placeShipForPlayer(g, socket.data.playerId, { kind, start, direction });
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
      const res = setPlayerReady(g, socket.data.playerId);
      if (!res.ok) {
        socket.emit('error', { message: res.reason });
        ack?.({ ok: false, reason: res.reason });
        return;
      }

      io.to(roomId(gameId)).emit('playerReady', { playerId: socket.data.playerId });

      // Keep snapshots consistent for reconnects and UI state.
      emitGameStateToSocket(socket, g, socket.data.playerId);
      const opp = getOpponent(g, socket.data.playerId);
      const oppSocketId = opp.id ? playerSockets.get(opp.id) : undefined;
      const oppSocket = oppSocketId ? (io.sockets.sockets.get(oppSocketId) as SeaBattleSocket | undefined) : undefined;
      if (oppSocket) emitGameStateToSocket(oppSocket, g, opp.id);

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
      const pid = socket.data.playerId;
      const shot = performShot(g, pid, x, y);
      io.to(roomId(gameId)).emit('shotResult', {
        by: pid,
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
      void getOpponent(g, pid);

      ack?.({ ok: true });
    } catch (e) {
      socket.emit('error', { message: (e as Error).message });
      ack?.({ ok: false, reason: (e as Error).message });
    }
  });
}

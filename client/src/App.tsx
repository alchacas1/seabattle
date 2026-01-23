import { useEffect, useMemo, useState, type DragEvent } from 'react';
import './App.css';
import { getSocket } from './lib/socket';
import { useGameStore } from './store/gameStore';
import { Board } from './components/Board';
import { tryPlaceAllShipsLocally } from './lib/autoplace';
import type { ShipKind } from './game/types';
import { FLEET_KINDS, SHIP_SPECS } from './game/types';
import { canPlaceOnLocalBoard, computeShipCells } from './lib/placementPreview';

function isShipKind(value: string): value is ShipKind {
  return Object.prototype.hasOwnProperty.call(SHIP_SPECS, value);
}

function App() {
  const socket = useMemo(() => getSocket(), []);

  const {
    phase,
    playerId,
    playerName,
    gameId,
    opponentJoined,
    players,
    currentTurn,
    winnerId,
    myBoard,
    enemyBoardView,
    toasts,
    setPlayerId,
    setPlayerName,
    setGame,
    setPhase,
    setOpponentJoined,
    setPlayers,
    markReady,
    setCurrentTurn,
    applyShotResult,
    resetBoards,
    resetPlacementState,
    placementDirection,
    selectedShipKind,
    placedKinds,
    selectShipKind,
    togglePlacementDirection,
    markKindPlaced,
    placeShipLocally,
    addToast,
  } = useGameStore();

  const [joinCode, setJoinCode] = useState('');
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [draggingKind, setDraggingKind] = useState<ShipKind | null>(null);
  const isMyTurn = !!playerId && currentTurn === playerId;

  const me = players.find((p) => p.id === playerId);
  const opp = players.find((p) => p.id !== playerId);
  const myDisplayName = me?.name ?? playerName;
  const oppDisplayName = opp?.name ?? (opponentJoined ? 'Rival' : 'Esperando...');

  const allPlaced = FLEET_KINDS.every((k) => placedKinds[k]);

  const placementOverlays = useMemo(() => {
    if (phase !== 'placing') return undefined;
    const activeKind = draggingKind ?? selectedShipKind;
    if (!activeKind || placedKinds[activeKind]) return undefined;
    if (!hover) return undefined;
    const cells = computeShipCells(hover, placementDirection, activeKind);
    const ok = canPlaceOnLocalBoard(myBoard, cells);
    const overlays: Record<string, 'preview-ok' | 'preview-bad'> = {};
    for (const c of cells) overlays[`${c.x},${c.y}`] = ok ? 'preview-ok' : 'preview-bad';
    return overlays;
  }, [phase, selectedShipKind, draggingKind, placedKinds, hover, placementDirection, myBoard]);

  useEffect(() => {
    socket.on('connected', ({ playerId }) => setPlayerId(playerId));
    socket.on('gameJoined', ({ gameId, youAre }) => {
      setGame(gameId, youAre);
      setPhase('placing');
      resetBoards();
      resetPlacementState();
      addToast(`Entraste a la partida ${gameId} (${youAre}).`);
    });
    socket.on('playerJoined', () => setOpponentJoined(true));
    socket.on('playersUpdated', ({ players }) => setPlayers(players));
    socket.on('playerReady', ({ playerId }) => markReady(playerId));
    socket.on('gameStarted', ({ currentTurn }) => {
      setPhase('playing');
      setCurrentTurn(currentTurn);
      addToast('Partida iniciada.');
    });
    socket.on('turnChanged', ({ currentTurn }) => setCurrentTurn(currentTurn));
    socket.on('shotResult', (payload) => applyShotResult(payload));
    socket.on('error', ({ message }) => addToast(`Error: ${message}`));

    return () => {
      socket.off('connected');
      socket.off('gameJoined');
      socket.off('playerJoined');
      socket.off('playersUpdated');
      socket.off('playerReady');
      socket.off('gameStarted');
      socket.off('turnChanged');
      socket.off('shotResult');
      socket.off('error');
    };
  }, [
    socket,
    setPlayerId,
    setGame,
    setPhase,
    resetBoards,
    resetPlacementState,
    addToast,
    setOpponentJoined,
    setPlayers,
    markReady,
    setCurrentTurn,
    applyShotResult,
  ]);

  async function handleCreate() {
    socket.emit('createGame', { name: playerName });
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    socket.emit('joinGame', { gameId: joinCode.trim(), name: playerName }, (res) => {
      if (!res.ok) addToast(`No se pudo unir: ${res.reason}`);
    });
  }

  async function handleAutoPlace() {
    if (!gameId) return;

    socket.emit('resetPlacement', { gameId }, (res) => {
      if (!res.ok) addToast(`Reset falló: ${res.reason}`);
    });
    resetBoards();
    resetPlacementState();

    const placements = tryPlaceAllShipsLocally();

    for (const p of placements) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await new Promise<boolean>((resolve) => {
        socket.emit(
          'placeShip',
          { gameId, kind: p.kind, start: p.start, direction: p.direction },
          (res) => resolve(res.ok),
        );
      });

      if (!ok) {
        addToast('Auto-placement falló. Reintenta.');
        return;
      }
      placeShipLocally(p.kind, p.start, p.direction);
      markKindPlaced(p.kind);
    }
    addToast('Barcos colocados (Auto).');
  }

  function handleReady() {
    if (!gameId) return;
    socket.emit('setReady', { gameId }, (res) => {
      if (!res.ok) addToast(`Ready falló: ${res.reason}`);
      else addToast('Listo. Esperando al rival...');
    });
  }

  async function placeKindAt(kind: ShipKind, x: number, y: number) {
    if (!gameId) return;
    if (placedKinds[kind]) return;

    const start = { x, y };
    const cells = computeShipCells(start, placementDirection, kind);
    if (!canPlaceOnLocalBoard(myBoard, cells)) {
      addToast('Posición inválida.');
      return;
    }

    socket.emit(
      'placeShip',
      { gameId, kind, start, direction: placementDirection },
      (res) => {
        if (!res.ok) {
          addToast(`No se pudo colocar: ${res.reason}`);
          return;
        }
        placeShipLocally(kind, start, placementDirection);
        markKindPlaced(kind);
        setDraggingKind(null);

        const next = FLEET_KINDS.find((k2) => !placedKinds[k2] && k2 !== kind) ?? null;
        if (next) selectShipKind(next);
      },
    );
  }

  async function handlePlaceSelectedAt(x: number, y: number) {
    if (!selectedShipKind) return;
    return placeKindAt(selectedShipKind, x, y);
  }

  function handleShipDragStart(kind: ShipKind, e: DragEvent<HTMLElement>) {
    if (placedKinds[kind]) return;
    setDraggingKind(kind);
    selectShipKind(kind);
    setHover(null);
    e.dataTransfer.setData('text/ship-kind', kind);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleShipDragEnd() {
    setDraggingKind(null);
    setHover(null);
  }

  function handleBoardDrop(x: number, y: number, shipKind: string) {
    if (!shipKind) return;
    if (!isShipKind(shipKind)) {
      addToast('Barco inválido.');
      return;
    }
    void placeKindAt(shipKind, x, y);
  }

  function handleShoot(x: number, y: number) {
    if (!gameId || !playerId) return;
    if (!isMyTurn) return;
    if (enemyBoardView[y]?.[x] === 'hit' || enemyBoardView[y]?.[x] === 'miss') return;

    socket.emit('shoot', { gameId, x, y }, (res) => {
      if (!res.ok) addToast(`Disparo inválido: ${res.reason}`);
    });
  }

  return (
    <div className="app">
      <header className="top">
        <div className="title">Sea Battle</div>
        <div className="meta">
          <div>
            <span className="k">tú</span> <span className="v">{myDisplayName}</span>
          </div>
          <div>
            <span className="k">rival</span> <span className="v">{oppDisplayName}</span>
          </div>
          <div>
            <span className="k">game</span> <span className="v mono">{gameId ?? '-'}</span>
          </div>
        </div>
      </header>

      {phase === 'lobby' && (
        <div className="panel">
          <h2>Lobby</h2>
          <div className="row">
            <input
              className="input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div className="row">
            <button className="btn" onClick={handleCreate}>
              Crear partida
            </button>
          </div>
          <div className="row">
            <input
              className="input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Game ID"
            />
            <button className="btn" onClick={handleJoin}>
              Unirse
            </button>
          </div>
          <div className="hint">Backend: {((import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3001')}</div>
        </div>
      )}

      {phase === 'placing' && (
        <div className="panel wide">
          <div className="placingHeader">
            <h2>Colocación</h2>
            <div className="hint">{opponentJoined ? 'Rival conectado.' : 'Esperando rival...'}</div>
          </div>

          <div className="placingLayout">
            <div className="placingLeft">
              <Board
                title={myDisplayName}
                board={myBoard}
                showShips
                interactive
                showAxis
                overlays={placementOverlays}
                onCellHover={(x, y) => setHover({ x, y })}
                onCellDrop={handleBoardDrop}
                onCellClick={(x, y) => void handlePlaceSelectedAt(x, y)}
              />

              <div className="placingButtons">
                <button className="btn" onClick={handleAutoPlace} disabled={!gameId}>
                  Auto
                </button>
                <button className="btn" onClick={togglePlacementDirection}>
                  Rotar ({placementDirection === 'horizontal' ? '—' : '|'})
                </button>
                <button className="btn battle" onClick={handleReady} disabled={!allPlaced || !gameId}>
                  ¡A la batalla!
                </button>
              </div>
            </div>

            <div className="placingRight">
              <div className="shipPanel">
                <div className="shipPanelTitle">Barcos</div>
                <div className="shipList">
                  {FLEET_KINDS.map((k) => {
                    const placed = placedKinds[k];
                    const selected = selectedShipKind === k;
                    const dragging = draggingKind === k;
                    return (
                      <button
                        key={k}
                        className={
                          'shipItem' +
                          (placed ? ' placed' : '') +
                          (selected ? ' selected' : '') +
                          (!placed ? ' draggable' : '') +
                          (dragging ? ' dragging' : '')
                        }
                        onClick={() => selectShipKind(k)}
                        disabled={placed}
                        draggable={!placed}
                        onDragStart={(e) => handleShipDragStart(k, e)}
                        onDragEnd={handleShipDragEnd}
                      >
                        <div className="shipName">{SHIP_SPECS[k].label}</div>
                        <div className="shipHint">{placed ? 'Colocado' : 'Arrastra o click para seleccionar'}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="hint small">Reglas: sin solape y sin adyacencia (incluye diagonal).</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'playing' && (
        <div className="panel wide">
          <div className="playingHeader">
            <h2>Batalla</h2>
            <div className="hint">
              Turno: <span className="mono">{currentTurn?.slice(0, 8) ?? '-'}</span> {isMyTurn ? '(tuyo)' : '(rival)'}
            </div>
          </div>
          <div className="boards">
            <Board title={myDisplayName} board={myBoard} showShips showAxis />
            <div className="versus">▶</div>
            <Board title={oppDisplayName} board={enemyBoardView} interactive={isMyTurn} onCellClick={handleShoot} showAxis />
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <div className="panel">
          <h2>Fin</h2>
          <div className="hint">
            Ganador: <span className="mono">{winnerId?.slice(0, 8) ?? '-'}</span>
          </div>
          <div className="row">
            <button className="btn" onClick={() => window.location.reload()}>
              Reiniciar cliente
            </button>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className="toast">
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;

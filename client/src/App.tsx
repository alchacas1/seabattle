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

const SIZE_ORDER = [4, 3, 2, 1] as const;
const SAVED_GAME_ID_KEY = 'seabattle:savedGameId';
const SAVED_GAME_NAME_KEY = 'seabattle:savedGameName';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
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
    setBoards,
    setPlacedKinds,
    setReadyPlayers,
    setWinnerId,
    placementDirection,
    selectedShipKind,
    placedKinds,
    selectShipKind,
    togglePlacementDirection,
    markKindPlaced,
    placeShipLocally,
    addToast,
  } = useGameStore();

  const [joinCode, setJoinCode] = useState(() => localStorage.getItem(SAVED_GAME_ID_KEY) ?? '');
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [draggingKind, setDraggingKind] = useState<ShipKind | null>(null);
  const isMyTurn = !!playerId && currentTurn === playerId;

  const outcome = useMemo(() => {
    if (phase !== 'finished') return null;
    if (!winnerId || !playerId) return 'unknown' as const;
    return winnerId === playerId ? ('win' as const) : ('lose' as const);
  }, [phase, winnerId, playerId]);

  useEffect(() => {
    const shouldSave = !!gameId && (phase !== 'finished' || opponentJoined);
    if (shouldSave) {
      localStorage.setItem(SAVED_GAME_ID_KEY, gameId!);
      localStorage.setItem(SAVED_GAME_NAME_KEY, playerName);
    } else {
      localStorage.removeItem(SAVED_GAME_ID_KEY);
      localStorage.removeItem(SAVED_GAME_NAME_KEY);
    }
  }, [gameId, phase, opponentJoined, playerName]);

  useEffect(() => {
    const savedGameId = localStorage.getItem(SAVED_GAME_ID_KEY);
    const savedName = localStorage.getItem(SAVED_GAME_NAME_KEY);
    if (phase !== 'lobby') return;
    if (savedGameId && !joinCode) setJoinCode(savedGameId);
    if (savedName && savedName.trim() && savedName !== playerName) {
      setPlayerName(savedName);
    }
  }, [phase, joinCode, playerName, setPlayerName]);

  const me = players.find((p) => p.id === playerId);
  const opp = players.find((p) => p.id !== playerId);
  const myDisplayName = me?.name ?? playerName;
  const oppDisplayName = opp?.name ?? (opponentJoined ? 'Rival' : 'Esperando...');

  const winnerDisplayName = useMemo(() => {
    if (!winnerId) return null;
    const winner = players.find((p) => p.id === winnerId);
    if (winner?.name) return winner.name;
    if (winnerId === playerId) return myDisplayName;
    if (opp?.id === winnerId) return oppDisplayName;
    return winnerId.slice(0, 8);
  }, [winnerId, players, playerId, myDisplayName, opp?.id, oppDisplayName]);

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
      addToast(`Entraste a la partida ${gameId} (${youAre}).`);
    });

    socket.on('gameState', (s) => {
      setGame(s.gameId, s.youAre);
      setPlayers(s.players);
      setOpponentJoined(s.players.length >= 2);
      setReadyPlayers(s.readyPlayers);
      setBoards(s.myBoard, s.enemyBoardView);
      setPlacedKinds(s.placedKinds);
      setWinnerId(s.winnerId ?? null);
      if (s.status === 'waiting') setPhase('lobby');
      else if (s.status === 'playing') setPhase('playing');
      else if (s.status === 'finished') setPhase('finished');
      else setPhase('placing');
      setCurrentTurn(s.currentTurn ?? null);
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
      socket.off('gameState');
      socket.off('error');
    };
  }, [
    socket,
    setPlayerId,
    setGame,
    setPhase,
    resetBoards,
    resetPlacementState,
    setBoards,
    setPlacedKinds,
    setReadyPlayers,
    setWinnerId,
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
    const savedGameId = localStorage.getItem(SAVED_GAME_ID_KEY);
    const savedName = localStorage.getItem(SAVED_GAME_NAME_KEY);
    if (savedGameId && savedName && joinCode.trim() === savedGameId && playerName !== savedName) {
      addToast(`Usa el mismo nombre para reingresar: ${savedName}`);
      return;
    }
    socket.emit('joinGame', { gameId: joinCode.trim(), name: playerName }, (res) => {
      if (!res.ok) addToast(`No se pudo unir: ${res.reason}`);
    });
  }

  async function handlePasteJoinCode() {
    try {
      const text = await navigator.clipboard.readText();
      const normalized = text.trim();
      if (!normalized) {
        addToast('Portapapeles vacío.');
        return;
      }
      setJoinCode(normalized);
      addToast('ID pegado.');
    } catch {
      addToast('No se pudo leer el portapapeles.');
    }
  }

  async function handleCopyGameId() {
    if (!gameId) return;
    const ok = await copyToClipboard(gameId);
    addToast(ok ? 'Game ID copiado.' : 'No se pudo copiar.');
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

        // Select consecutively: keep same size while available, then go to next size group.
        const placedSize = SHIP_SPECS[kind].size;
        const nextSameSize = FLEET_KINDS.find((k2) => !placedKinds[k2] && SHIP_SPECS[k2].size === placedSize && k2 !== kind);
        const nextAny =
          nextSameSize ??
          SIZE_ORDER.flatMap((size) => FLEET_KINDS.filter((k2) => SHIP_SPECS[k2].size === size)).find((k2) => !placedKinds[k2] && k2 !== kind) ??
          null;

        if (nextAny) selectShipKind(nextAny);
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
        <div className="titleRow">
          <img className="logo" src="/android-chrome-192x192.png" width={32} height={32} alt="" aria-hidden="true" />
          <div className="title">Sea Battle</div>
        </div>
        <div className="meta">
          <div>
            <span className="k">tú</span> <span className="v">{myDisplayName}</span>
          </div>
          <div>
            <span className="k">rival</span> <span className="v">{oppDisplayName}</span>
          </div>
          <div>
            <span className="k">game</span>{' '}
            <button
              type="button"
              className="copyId mono"
              onClick={() => void handleCopyGameId()}
              disabled={!gameId}
              title={gameId ? 'Click para copiar' : ''}
            >
              {gameId ?? '-'}
            </button>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleJoin();
              }}
              placeholder="Game ID"
            />
            <button className="btn secondary" onClick={() => void handlePasteJoinCode()}>
              Pegar
            </button>
            <button className="btn" onClick={handleJoin}>
              Unirse
            </button>
          </div>
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
                <div className="shipPanelHeader">
                  <div className="shipPanelTitle">Barcos</div>
                  <div className="shipPanelProgress mono">
                    {FLEET_KINDS.filter((k) => placedKinds[k]).length}/{FLEET_KINDS.length}
                  </div>
                </div>
                <div className="hint small">Arrastra al tablero o clic para seleccionar. Usa “Rotar” para cambiar orientación.</div>
                <div className="shipList">
                  {SIZE_ORDER.map((size) => {
                    const kindsInGroup = FLEET_KINDS.filter((k) => SHIP_SPECS[k].size === size);
                    const remainingKinds = kindsInGroup.filter((k) => !placedKinds[k]);
                    const remaining = remainingKinds.length;
                    const first = remainingKinds[0] ?? null;
                    const selected = !!selectedShipKind && SHIP_SPECS[selectedShipKind].size === size;
                    const dragging = !!draggingKind && SHIP_SPECS[draggingKind].size === size;

                    const label = `${size}x1${size === 4 ? '' : ` (${remaining})`}`;

                    return (
                      <button
                        key={`group-${size}`}
                        className={
                          'shipItem' +
                          (remaining === 0 ? ' placed' : '') +
                          (selected ? ' selected' : '') +
                          (remaining > 0 ? ' draggable' : '') +
                          (dragging ? ' dragging' : '')
                        }
                        onClick={() => {
                          if (!first) return;
                          selectShipKind(first);
                        }}
                        disabled={remaining === 0}
                        draggable={remaining > 0}
                        onDragStart={(e) => {
                          if (!first) return;
                          handleShipDragStart(first, e);
                        }}
                        onDragEnd={handleShipDragEnd}
                      >
                        <div className="shipTopRow">
                          <div className="shipName">{label}</div>
                          {remaining === 0 && <div className="shipBadge">Listo</div>}
                        </div>
                        <div className="shipSizeRow" aria-hidden>
                          {Array.from({ length: size }).map((_, i) => (
                            <span key={i} className="shipBlock" />
                          ))}
                        </div>
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
            Ganador: <span className="mono">{winnerDisplayName ?? '-'}</span>
          </div>
          <div className="row">
            <button className="btn" onClick={() => window.location.reload()}>
              Reiniciar cliente
            </button>
          </div>
        </div>
      )}

      {phase === 'finished' && (
        <div
          className={
            'outcomeOverlay' +
            (outcome === 'win' ? ' win' : outcome === 'lose' ? ' lose' : '')
          }
          role="dialog"
          aria-modal="true"
          aria-label={outcome === 'win' ? 'Ganaste' : outcome === 'lose' ? 'Perdiste' : 'Fin de la partida'}
        >
          <div className="outcomeBackdrop" />
          <div className="outcomeCard">
            <div className="outcomeSpark" aria-hidden />
            <div className="outcomeSpark s2" aria-hidden />
            <div className="outcomeSpark s3" aria-hidden />

            <div className="outcomeTitle">
              {outcome === 'win' && '¡GANASTE!'}
              {outcome === 'lose' && 'PERDISTE'}
              {outcome === 'unknown' && 'FIN'}
            </div>
            <div className="outcomeSubtitle">
              {outcome === 'win' && 'Buen disparo, capitán.'}
              {outcome === 'lose' && 'Tu flota fue hundida.'}
              {outcome === 'unknown' && 'La partida terminó.'}
            </div>

            <div className="outcomeMeta">
              Ganador: <span className="mono">{winnerDisplayName ?? '-'}</span>
            </div>

            <div className="outcomeActions">
              <button className="btn" onClick={() => window.location.reload()}>
                Jugar otra
              </button>
            </div>
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

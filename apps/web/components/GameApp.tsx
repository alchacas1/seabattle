"use client";

import { useCallback, useEffect, useState } from "react";
import type { Coordinate, Ship } from "@sea-battle/shared-types";
import { AppFooter } from "./AppFooter";
import { BattleScreen } from "./BattleScreen";
import { ConnectionStatus } from "./ConnectionStatus";
import { HomeScreen } from "./HomeScreen";
import { LobbyScreen } from "./LobbyScreen";
import { PlacementScreen } from "./PlacementScreen";
import { ResultScreen } from "./ResultScreen";
import {
  attackCell,
  confirmFleet,
  createRoom,
  ensureAnonymousAuth,
  getAutoFleet,
  joinRoom,
  leaveRoom,
  requestRematch,
  subscribePresence,
  subscribeToGame,
  syncGame,
  trackPresence,
} from "@/services/game-service";
import { useGameStore } from "@/stores/game-store";
import { readableError } from "@/lib/error-message";

export function GameApp() {
  const store = useGameStore();
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rematchPending, setRematchPending] = useState(false);
  const currentGameId = store.gameId;
  const currentUid = store.uid;
  const rematchGameId = store.game?.rematchGameId;
  const enterGame = useCallback((gameId: string, serverTime: number) => {
    const actions = useGameStore.getState();
    actions.setServerTime(serverTime);
    actions.setGameId(gameId);
    actions.setResumableGameId(null);
  }, []);

  useEffect(
    () =>
      ensureAnonymousAuth(
        async (user) => {
          const actions = useGameStore.getState();
          actions.setUid(user.uid);
          try {
            const synced = await syncGame();
            actions.setServerTime(synced.serverTime);
            actions.setResumableGameId(synced.gameId);
          } catch (caught) {
            setError(readableError(caught));
          } finally {
            setBooting(false);
          }
        },
        (caught) => {
          setError(readableError(caught));
          setBooting(false);
        },
      ),
    [],
  );

  useEffect(() => {
    if (!currentGameId) return;
    const actions = useGameStore.getState();
    const unsubscribe = subscribeToGame(currentGameId, {
      game: actions.setGame,
      players: actions.setPlayers,
      boards: actions.setBoards,
      events: actions.setEvents,
      error: (caught) => setError(readableError(caught)),
    });
    void syncGame(currentGameId)
      .then((synced) => {
        actions.setServerTime(synced.serverTime);
        actions.setOwnFleet(synced.ownFleet ?? []);
      })
      .catch((caught) => setError(readableError(caught)));
    return unsubscribe;
  }, [currentGameId]);

  useEffect(() => {
    if (!currentUid) return;
    return trackPresence(
      currentUid,
      currentGameId,
      useGameStore.getState().setConnected,
    );
  }, [currentGameId, currentUid]);

  const rivalId =
    store.game && store.uid
      ? store.game.player1Id === store.uid
        ? store.game.player2Id
        : store.game.player1Id
      : null;
  useEffect(() => {
    const actions = useGameStore.getState();
    actions.setRivalOnline(null);
    if (!rivalId) return;
    return subscribePresence(rivalId, actions.setRivalOnline);
  }, [rivalId]);

  useEffect(() => {
    if (!rematchGameId || rematchGameId === currentGameId) return;
    void syncGame(rematchGameId)
      .then((synced) => {
        enterGame(rematchGameId, synced.serverTime);
        useGameStore.getState().setOwnFleet(synced.ownFleet ?? []);
        setRematchPending(false);
      })
      .catch((caught) => setError(readableError(caught)));
  }, [currentGameId, enterGame, rematchGameId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  };
  if (booting)
    return (
      <main className="center-screen">
        <div className="sonar">
          <span />
          <span />
          <span />
        </div>
        <p>Preparando el puesto de mando…</p>
      </main>
    );

  let screen;
  if (!store.gameId) {
    screen = (
      <HomeScreen
        busy={busy}
        resumableGameId={store.resumableGameId}
        onCreate={(name) =>
          run(async () => {
            const result = await createRoom(name);
            localStorage.setItem("sea-battle-name", name.trim());
            enterGame(result.gameId, result.serverTime);
          })
        }
        onJoin={(name, code) =>
          run(async () => {
            const result = await joinRoom(name, code);
            localStorage.setItem("sea-battle-name", name.trim());
            enterGame(result.gameId, result.serverTime);
          })
        }
        onResume={() =>
          run(async () => {
            if (!store.resumableGameId) return;
            const result = await syncGame(store.resumableGameId);
            enterGame(store.resumableGameId, result.serverTime);
            store.setOwnFleet(result.ownFleet ?? []);
          })
        }
      />
    );
  } else if (!store.game || !store.uid) {
    screen = (
      <main className="center-screen">
        <div className="sonar">
          <span />
          <span />
          <span />
        </div>
        <p>Sincronizando partida…</p>
      </main>
    );
  } else if (store.game.status === "WAITING_PLAYER") {
    screen = (
      <LobbyScreen game={store.game} players={store.players} uid={store.uid} />
    );
  } else if (
    store.game.status === "PLACING_SHIPS" ||
    store.game.status === "READY"
  ) {
    screen = (
      <PlacementScreen
        initialFleet={store.ownFleet}
        confirmed={store.players[store.uid]?.fleetConfirmed ?? false}
        onAuto={() => getAutoFleet(store.gameId!)}
        onConfirm={(fleet: Ship[]) =>
          run(async () => {
            await confirmFleet(store.gameId!, fleet);
            store.setOwnFleet(fleet);
          })
        }
      />
    );
  } else if (store.game.status === "PLAYING") {
    screen = (
      <BattleScreen
        game={store.game}
        uid={store.uid}
        players={store.players}
        boards={store.boards}
        ownFleet={store.ownFleet}
        events={store.events}
        serverOffset={store.serverOffset}
        onAttack={(coordinate: Coordinate) =>
          run(async () => {
            await attackCell(store.gameId!, coordinate);
          })
        }
      />
    );
  } else {
    screen = (
      <ResultScreen
        game={store.game}
        uid={store.uid}
        players={store.players}
        events={store.events}
        rematchPending={rematchPending}
        onRematch={() =>
          void run(async () => {
            setRematchPending(true);
            const result = await requestRematch(store.gameId!);
            if (result.ready && result.gameId)
              enterGame(result.gameId, result.serverTime);
          })
        }
        onExit={() =>
          void run(async () => {
            if (store.gameId) await leaveRoom(store.gameId);
            store.reset();
            setRematchPending(false);
          })
        }
      />
    );
  }

  return (
    <>
      <div className="app-status">
        <ConnectionStatus
          connected={store.connected}
          rivalOnline={store.rivalOnline}
        />
      </div>
      {!store.connected && (
        <div className="reconnect-banner">
          <strong>Conexión perdida.</strong> La partida continúa en el servidor.
          Reconectando…
        </div>
      )}
      {error && (
        <div className="error-toast" role="alert">
          {error}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
      {screen}
      <AppFooter />
    </>
  );
}

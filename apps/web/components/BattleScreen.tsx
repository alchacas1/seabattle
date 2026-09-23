"use client";

import { useState } from "react";
import {
  coordinateKey,
  type AttackResult,
  type Coordinate,
  type GameEvent,
  type PlayerState,
  type PublicBoard,
  type PublicGameState,
  type Ship,
} from "@sea-battle/shared-types";
import { BattleLog } from "./BattleLog";
import { GameBoard } from "./GameBoard";
import { TurnTimer } from "./TurnTimer";

export function BattleScreen({
  game,
  uid,
  players,
  boards,
  ownFleet,
  events,
  serverOffset,
  onAttack,
}: {
  game: PublicGameState;
  uid: string;
  players: Record<string, PlayerState>;
  boards: Record<string, PublicBoard>;
  ownFleet: Ship[];
  events: GameEvent[];
  serverOffset: number;
  onAttack: (coordinate: Coordinate) => Promise<void>;
}) {
  const [pendingAttack, setPendingAttack] = useState<Coordinate | null>(null);
  const [orientationNotice, setOrientationNotice] = useState("");
  const rivalId = game.player1Id === uid ? game.player2Id : game.player1Id;
  const myTurn = game.currentTurnPlayerId === uid;
  const rivalAttacks: Record<string, AttackResult> = rivalId
    ? (boards[rivalId]?.attackedCells ?? {})
    : {};
  const attackPending =
    pendingAttack !== null && !rivalAttacks[coordinateKey(pendingAttack)];
  const activateLandscape = async () => {
    try {
      if (
        !document.fullscreenElement &&
        document.documentElement.requestFullscreen
      ) {
        await document.documentElement.requestFullscreen();
      }
      const orientation = window.screen.orientation as ScreenOrientation & {
        lock?: (orientation: "landscape") => Promise<void>;
      };
      if (!orientation?.lock) throw new Error("Orientation lock unavailable");
      await orientation.lock("landscape");
      setOrientationNotice("Vista horizontal activada");
    } catch {
      setOrientationNotice("Gira el teléfono para activar la vista horizontal");
    }
  };
  return (
    <main className="battle-screen">
      <header className="battle-header">
        <div>
          <p className="eyebrow">Sala {game.roomCode}</p>
          <h1>
            {myTurn
              ? "Tu turno"
              : `Turno de ${rivalId ? (players[rivalId]?.name ?? "tu rival") : "tu rival"}`}
          </h1>
        </div>
        <TurnTimer
          turnEndsAt={game.turnEndsAt}
          serverOffset={serverOffset}
          totalSeconds={game.rules.turnSeconds}
        />
      </header>
      <div className="mobile-orientation-control">
        <button
          className="button button--compact"
          type="button"
          aria-label="Activar vista horizontal"
          onClick={() => void activateLandscape()}
        >
          <span aria-hidden="true">↻</span> Vista horizontal
        </button>
        {orientationNotice && (
          <p className="orientation-notice" aria-live="polite">
            {orientationNotice}
          </p>
        )}
      </div>
      <section className="battle-grid">
        <div className="board-panel own-board">
          <h2>Tu flota</h2>
          <GameBoard
            mode="own"
            ships={ownFleet}
            attackedCells={boards[uid]?.attackedCells ?? {}}
          />
        </div>
        <div
          className={`turn-indicator turn-indicator--${myTurn ? "enemy" : "own"}`}
          role="status"
          aria-label={`Objetivo del ataque: ${myTurn ? "Flota enemiga" : "Tu flota"}`}
        >
          <span className="turn-indicator__arrow" aria-hidden="true">
            ➜
          </span>
          <strong>{myTurn ? "Atacas aquí" : "El rival ataca aquí"}</strong>
        </div>
        <div className="board-panel enemy-board">
          <h2>Flota enemiga</h2>
          <GameBoard
            mode="enemy"
            attackedCells={rivalAttacks}
            disabled={!myTurn || attackPending}
            onSelect={async (coordinate) => {
              if (attackPending) return;
              setPendingAttack(coordinate);
              try {
                await onAttack(coordinate);
              } catch {
                setPendingAttack(null);
              }
            }}
          />
          <p className="attack-guidance" role="status">
            {attackPending
              ? "Atacando..."
              : myTurn
                ? "Toca una coordenada para atacar"
                : "Espera tu turno"}
          </p>
        </div>
      </section>
      <section className="paper-panel arsenal">
        <div>
          <p className="eyebrow">Fase táctica</p>
          <h2>Arsenal</h2>
        </div>
        <p>
          Radar, minas y submarino quedan preparados en la arquitectura; la
          batalla clásica protege el equilibrio de esta versión.
        </p>
      </section>
      <BattleLog events={events} players={players} />
    </main>
  );
}

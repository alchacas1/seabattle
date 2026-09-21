"use client";

import { useState } from "react";
import type {
  Coordinate,
  GameEvent,
  PlayerState,
  PublicBoard,
  PublicGameState,
  Ship,
} from "@sea-battle/shared-types";
import { BattleLog } from "./BattleLog";
import { GameBoard } from "./GameBoard";
import { TurnTimer } from "./TurnTimer";

const label = (coordinate: Coordinate | null) =>
  coordinate ? `${"ABCDEFGHIJ"[coordinate.row]}${coordinate.col + 1}` : "";

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
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [busy, setBusy] = useState(false);
  const [showOwn, setShowOwn] = useState(false);
  const rivalId = game.player1Id === uid ? game.player2Id : game.player1Id;
  const myTurn = game.currentTurnPlayerId === uid;
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
      <section className="battle-grid">
        <div
          className={`board-panel own-board${showOwn ? " own-board--shown" : ""}`}
        >
          <h2>Tu flota</h2>
          <GameBoard
            mode="own"
            ships={ownFleet}
            attackedCells={boards[uid]?.attackedCells ?? {}}
          />
        </div>
        <div className="board-panel enemy-board">
          <h2>Flota enemiga</h2>
          <GameBoard
            mode="enemy"
            attackedCells={
              rivalId ? (boards[rivalId]?.attackedCells ?? {}) : {}
            }
            selected={selected}
            disabled={!myTurn || busy}
            onSelect={setSelected}
          />
          <button
            className="button button--attack"
            type="button"
            disabled={!myTurn || !selected || busy}
            onClick={async () => {
              if (!selected) return;
              setBusy(true);
              try {
                await onAttack(selected);
                setSelected(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            {selected
              ? `Atacar ${label(selected)}`
              : myTurn
                ? "Elige una coordenada"
                : "Espera tu turno"}
          </button>
          <button
            className="mobile-fleet-toggle"
            type="button"
            onClick={() => setShowOwn((value) => !value)}
          >
            {showOwn ? "Ocultar mi flota" : "Ver mi flota"}
          </button>
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

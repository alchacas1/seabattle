"use client";

import { useMemo, useState } from "react";
import { validateShipPlacement } from "@sea-battle/game-engine";
import type { Coordinate, Orientation, Ship } from "@sea-battle/shared-types";
import { GameBoard } from "./GameBoard";

const specs = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1].map((size, index) => ({
  id: `ship-${index + 1}`,
  size,
}));

export function PlacementScreen({
  initialFleet,
  confirmed,
  onAuto,
  onConfirm,
}: {
  initialFleet: Ship[];
  confirmed: boolean;
  onAuto: () => Promise<Ship[]>;
  onConfirm: (fleet: Ship[]) => Promise<void>;
}) {
  const [fleet, setFleet] = useState<Ship[]>(initialFleet);
  const [selectedId, setSelectedId] = useState<string | null>(specs[0]!.id);
  const [orientation, setOrientation] = useState<Orientation>("H");
  const [message, setMessage] = useState(
    "Selecciona un barco y una coordenada.",
  );
  const [busy, setBusy] = useState(false);
  const pending = useMemo(
    () => specs.filter((spec) => !fleet.some((ship) => ship.id === spec.id)),
    [fleet],
  );
  const place = (coordinate: Coordinate) => {
    if (confirmed) return;
    const occupied = fleet.find((ship) =>
      ship.cells.some(
        (cell) => cell.row === coordinate.row && cell.col === coordinate.col,
      ),
    );
    if (occupied) {
      setFleet((current) => current.filter((ship) => ship.id !== occupied.id));
      setSelectedId(occupied.id);
      setMessage("Barco retirado. Puedes colocarlo de nuevo.");
      return;
    }
    const spec = specs.find((item) => item.id === selectedId) ?? pending[0];
    if (!spec) return;
    const candidate: Ship = {
      id: spec.id,
      size: spec.size,
      orientation,
      cells: Array.from({ length: spec.size }, (_, index) => ({
        row: coordinate.row + (orientation === "V" ? index : 0),
        col: coordinate.col + (orientation === "H" ? index : 0),
      })),
      hits: [],
      sunk: false,
    };
    const validation = validateShipPlacement(
      fleet.filter((ship) => ship.id !== spec.id),
      candidate,
    );
    if (!validation.valid) {
      setMessage(
        validation.reason === "ADJACENT"
          ? "Los barcos no pueden tocarse, ni en diagonal."
          : "Ese barco no cabe en esa posición.",
      );
      return;
    }
    const next = [...fleet.filter((ship) => ship.id !== spec.id), candidate];
    setFleet(next);
    setSelectedId(
      specs.find((item) => !next.some((ship) => ship.id === item.id))?.id ??
        null,
    );
    setMessage("Posición anotada.");
  };

  if (confirmed) {
    return (
      <main className="center-screen">
        <div className="hero-mark">✓</div>
        <h1>Tu flota está lista</h1>
        <p>Esperando que el rival confirme la suya…</p>
        <div className="sonar">
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  }

  return (
    <main className="placement-screen">
      <header className="screen-heading">
        <div>
          <p className="eyebrow">Preparación</p>
          <h1>Despliega tu flota</h1>
        </div>
        <p>{message}</p>
      </header>
      <section className="placement-layout">
        <div className="board-panel">
          <GameBoard mode="placement" ships={fleet} onPlace={place} />
        </div>
        <aside className="paper-panel ship-inventory">
          <div className="inventory-heading">
            <h2>Flota</h2>
            <button
              className="icon-button"
              type="button"
              onClick={() =>
                setOrientation((value) => (value === "H" ? "V" : "H"))
              }
            >
              ↻ {orientation === "H" ? "Horizontal" : "Vertical"}
            </button>
          </div>
          <div className="ship-list">
            {specs.map((spec) => {
              const placed = fleet.some((ship) => ship.id === spec.id);
              return (
                <button
                  key={spec.id}
                  type="button"
                  draggable={!placed}
                  disabled={placed}
                  className={`ship-token${selectedId === spec.id ? " ship-token--selected" : ""}`}
                  onDragStart={() => setSelectedId(spec.id)}
                  onClick={() => setSelectedId(spec.id)}
                >
                  <span>{"▰".repeat(spec.size)}</span>
                  <small>
                    {spec.size} celdas {placed ? "· colocado" : ""}
                  </small>
                </button>
              );
            })}
          </div>
          <div className="button-stack">
            <button
              className="button button--outline"
              disabled={busy}
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  setFleet(await onAuto());
                  setSelectedId(null);
                  setMessage("Flota colocada automáticamente.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Auto
            </button>
            <button
              className="button button--ghost"
              disabled={busy || fleet.length === 0}
              type="button"
              onClick={() => {
                setFleet([]);
                setSelectedId(specs[0]!.id);
              }}
            >
              Reiniciar
            </button>
            <button
              className="button button--primary"
              disabled={busy || pending.length > 0}
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm(fleet);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar flota
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

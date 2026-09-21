"use client";

import {
  coordinateKey,
  type AttackResult,
  type Coordinate,
  type Ship,
} from "@sea-battle/shared-types";

interface GameBoardProps {
  mode: "own" | "enemy" | "placement";
  attackedCells?: Record<string, AttackResult>;
  ships?: Ship[];
  selected?: Coordinate | null;
  onSelect?: (coordinate: Coordinate) => void;
  onPlace?: (coordinate: Coordinate) => void;
  disabled?: boolean;
}

const letters = "ABCDEFGHIJ";

function cellPresentation(
  mode: GameBoardProps["mode"],
  coordinate: Coordinate,
  attackedCells: Record<string, AttackResult>,
  ships: Ship[],
): { label: string; symbol: string; state: string } {
  const key = coordinateKey(coordinate);
  const attack = attackedCells[key];
  const ship = ships.find((candidate) =>
    candidate.cells.some((cell) => coordinateKey(cell) === key),
  );
  if (ship?.sunk && attack)
    return { label: "barco hundido", symbol: "🔥", state: "sunk" };
  if (attack === "MISS") return { label: "agua", symbol: "●", state: "miss" };
  if (attack === "HIT") return { label: "impacto", symbol: "✕", state: "hit" };
  if (attack === "SUNK")
    return { label: "hundido", symbol: "🔥", state: "sunk" };
  if (ship && mode !== "enemy")
    return { label: "barco propio", symbol: "■", state: "ship" };
  return { label: "desconocido", symbol: "", state: "unknown" };
}

export function GameBoard({
  mode,
  attackedCells = {},
  ships = [],
  selected = null,
  onSelect,
  onPlace,
  disabled = false,
}: GameBoardProps) {
  return (
    <div className="board-wrap">
      <div className="board-corner" aria-hidden="true" />
      {Array.from({ length: 10 }, (_, col) => (
        <div className="board-label" aria-hidden="true" key={`col-${col}`}>
          {col + 1}
        </div>
      ))}
      {Array.from({ length: 10 }, (_, row) => (
        <div className="board-row" key={`row-${row}`}>
          <div className="board-label" aria-hidden="true">
            {letters[row]}
          </div>
          {Array.from({ length: 10 }, (_, col) => {
            const coordinate = { row, col };
            const presentation = cellPresentation(
              mode,
              coordinate,
              attackedCells,
              ships,
            );
            const coordinateLabel = `${letters[row]}${col + 1}`;
            const isSelected = selected?.row === row && selected.col === col;
            const className = `board-cell board-cell--${presentation.state}${isSelected ? " board-cell--selected" : ""}`;
            if (mode === "enemy") {
              return (
                <button
                  type="button"
                  className={className}
                  aria-label={`${coordinateLabel}, ${presentation.label}`}
                  aria-pressed={isSelected}
                  disabled={disabled || presentation.state !== "unknown"}
                  onClick={() => onSelect?.(coordinate)}
                  key={coordinateLabel}
                >
                  {presentation.symbol}
                </button>
              );
            }
            return (
              <div
                role="gridcell"
                tabIndex={mode === "placement" ? 0 : -1}
                className={className}
                aria-label={`${coordinateLabel}, ${presentation.label}`}
                onClick={() => onPlace?.(coordinate)}
                onKeyDown={(event) => {
                  if (
                    (event.key === "Enter" || event.key === " ") &&
                    mode === "placement"
                  )
                    onPlace?.(coordinate);
                }}
                onDragOver={(event) =>
                  mode === "placement" && event.preventDefault()
                }
                onDrop={(event) => {
                  if (mode !== "placement") return;
                  event.preventDefault();
                  onPlace?.(coordinate);
                }}
                key={coordinateLabel}
              >
                {presentation.symbol}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

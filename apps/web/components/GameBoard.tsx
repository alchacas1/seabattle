"use client";

import {
  coordinateKey,
  type AttackResult,
  type Coordinate,
  type Ship,
} from "@sea-battle/shared-types";
import tableroImage from "@/app/images/tablero.png";
import shipBodyImage from "@/app/images/base.png";
import destroyedShipBodyImage from "@/app/images/baseD.png";
import shipStartImage from "@/app/images/ini.png";
import destroyedShipStartImage from "@/app/images/iniD.png";

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

type ImageAsset = string | { src: string };

const imageUrl = (asset: ImageAsset) =>
  typeof asset === "string" ? asset : asset.src;

const artwork = {
  tile: imageUrl(tableroImage),
  start: imageUrl(shipStartImage),
  body: imageUrl(shipBodyImage),
  destroyedStart: imageUrl(destroyedShipStartImage),
  destroyedBody: imageUrl(destroyedShipBodyImage),
};

function locateShipSegment(ships: Ship[], coordinate: Coordinate) {
  const key = coordinateKey(coordinate);
  for (const ship of ships) {
    const segmentIndex = ship.cells.findIndex(
      (cell) => coordinateKey(cell) === key,
    );
    if (segmentIndex >= 0) return { ship, segmentIndex };
  }
  return null;
}

function isShipDestroyed(
  ship: Ship,
  attackedCells: Record<string, AttackResult>,
) {
  return (
    ship.sunk ||
    ship.cells.every((cell) => {
      const result = attackedCells[coordinateKey(cell)];
      return result === "HIT" || result === "SUNK";
    })
  );
}

function cellPresentation(
  mode: GameBoardProps["mode"],
  attackedCells: Record<string, AttackResult>,
  coordinate: Coordinate,
  ship: Ship | undefined,
  shipDestroyed: boolean,
): { label: string; symbol: string; state: string } {
  const key = coordinateKey(coordinate);
  const attack = attackedCells[key];
  if (shipDestroyed && attack)
    return { label: "barco hundido", symbol: "✕", state: "sunk" };
  if (attack === "MISS") return { label: "agua", symbol: "●", state: "miss" };
  if (attack === "HIT") return { label: "impacto", symbol: "✕", state: "hit" };
  if (attack === "SUNK")
    return { label: "hundido", symbol: "✕", state: "sunk" };
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
            const locatedSegment = locateShipSegment(ships, coordinate);
            const shipDestroyed = locatedSegment
              ? isShipDestroyed(locatedSegment.ship, attackedCells)
              : false;
            const presentation = cellPresentation(
              mode,
              attackedCells,
              coordinate,
              locatedSegment?.ship,
              shipDestroyed,
            );
            const coordinateLabel = `${letters[row]}${col + 1}`;
            const isSelected = selected?.row === row && selected.col === col;
            const className = `board-cell board-cell--${presentation.state}${isSelected ? " board-cell--selected" : ""}`;
            const shipArtwork = locatedSegment
              ? shipDestroyed
                ? locatedSegment.segmentIndex === 0
                  ? artwork.destroyedStart
                  : artwork.destroyedBody
                : locatedSegment.segmentIndex === 0
                  ? artwork.start
                  : artwork.body
              : null;
            const contents = (
              <>
                <span
                  aria-hidden="true"
                  className="board-cell__tile"
                  style={{ backgroundImage: `url("${artwork.tile}")` }}
                />
                {locatedSegment && shipArtwork && mode !== "enemy" && (
                  <span
                    aria-hidden="true"
                    className="board-cell__ship"
                    style={{
                      backgroundImage: `url("${shipArtwork}")`,
                      transform: `rotate(${locatedSegment.ship.orientation === "V" ? 90 : 0}deg)`,
                    }}
                  />
                )}
                {presentation.symbol && (
                  <span className="board-cell__symbol">
                    {presentation.symbol}
                  </span>
                )}
              </>
            );
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
                  {contents}
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
                {contents}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

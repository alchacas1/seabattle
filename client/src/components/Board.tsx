import type { DragEvent } from 'react';
import type { CellState } from '../game/types';
import { BOARD_SIZE } from '../game/board';
import './Board.css';

const SHIP_IMAGE_START = '/Punta.png';
const SHIP_IMAGE_SECTION = '/Seccion.png';

function isShipLike(state: CellState): boolean {
  return state === 'ship' || state === 'hit' || state === 'sunk';
}

function computeShipMetadata(board: CellState[][]): {
  startCells: Set<string>;
  orientationByCell: Map<string, 'horizontal' | 'vertical'>;
} {
  const startCells = new Set<string>();
  const orientationByCell = new Map<string, 'horizontal' | 'vertical'>();
  const visited = new Set<string>();

  const pushIf = (queue: Array<{ x: number; y: number }>, x: number, y: number) => {
    const s = board[y]?.[x];
    if (!s || !isShipLike(s)) return;
    const key = `${x},${y}`;
    if (visited.has(key)) return;
    queue.push({ x, y });
  };

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const state = board[y]?.[x];
      if (!state || !isShipLike(state)) continue;

      const rootKey = `${x},${y}`;
      if (visited.has(rootKey)) continue;

      const queue: Array<{ x: number; y: number }> = [{ x, y }];
      const cells: Array<{ x: number; y: number }> = [];

      while (queue.length) {
        const cur = queue.shift()!;
        const key = `${cur.x},${cur.y}`;
        if (visited.has(key)) continue;
        visited.add(key);

        const s = board[cur.y]?.[cur.x];
        if (!s || !isShipLike(s)) continue;

        cells.push(cur);

        pushIf(queue, cur.x + 1, cur.y);
        pushIf(queue, cur.x - 1, cur.y);
        pushIf(queue, cur.x, cur.y + 1);
        pushIf(queue, cur.x, cur.y - 1);
      }

      if (cells.length === 0) continue;

      const allSameY = cells.every((c) => c.y === cells[0].y);
      const allSameX = cells.every((c) => c.x === cells[0].x);
      const orientation: 'horizontal' | 'vertical' = allSameY ? 'horizontal' : 'vertical';

      // Tag every cell with ship orientation (used for rotating images).
      for (const c of cells) {
        orientationByCell.set(`${c.x},${c.y}`, orientation);
      }

      // Pick the ship "start" cell.
      let start: { x: number; y: number };
      if (cells.length === 1) {
        start = cells[0];
      } else if (allSameY) {
        // Horizontal ships are placed to the right, so the start is the leftmost cell.
        start = cells.reduce((best, c) => (c.x < best.x ? c : best), cells[0]);
      } else if (allSameX) {
        // Vertical ships are placed downward, so the start is the topmost cell.
        start = cells.reduce((best, c) => (c.y < best.y ? c : best), cells[0]);
      } else {
        // Shouldn't happen in a valid board, but keep a deterministic fallback.
        start = cells
          .slice()
          .sort((a, b) => (a.y - b.y !== 0 ? a.y - b.y : a.x - b.x))[0];
      }

      startCells.add(`${start.x},${start.y}`);
    }
  }

  return { startCells, orientationByCell };
}

type Props = {
  title: string;
  board: CellState[][];
  interactive?: boolean;
  onCellClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number) => void;
  onCellDrop?: (x: number, y: number, shipKind: string) => void;
  showShips?: boolean;
  showAxis?: boolean;
  overlays?: Record<string, 'preview-ok' | 'preview-bad'>;
};

function cellClass(state: CellState, showShips: boolean, overlay?: string): string {
  if (state === 'ship' && !showShips) return 'cell empty';
  return `cell ${state}${overlay ? ` ${overlay}` : ''}`;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export function Board({
  title,
  board,
  interactive,
  onCellClick,
  onCellHover,
  onCellDrop,
  showShips = false,
  showAxis = true,
  overlays,
}: Props) {
  const shipMeta = showShips ? computeShipMetadata(board) : null;

  function handleDragOver(e: DragEvent<HTMLButtonElement>, x: number, y: number) {
    if (!onCellDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onCellHover?.(x, y);
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>, x: number, y: number) {
    if (!onCellDrop) return;
    e.preventDefault();
    const kind = e.dataTransfer.getData('text/ship-kind') || e.dataTransfer.getData('text/plain');
    if (!kind) return;
    onCellDrop(x, y, kind);
  }

  return (
    <div className="boardWrap">
      <div className="boardTitle">{title}</div>
      <div className={interactive ? 'gridWrap interactive' : 'gridWrap'}>
        {showAxis && <div className="axisSpacer" />}
        {showAxis && (
          <div className="axisTop">
            {Array.from({ length: BOARD_SIZE }).map((_, i) => (
              <div key={i} className="axisLabel">
                {i + 1}
              </div>
            ))}
          </div>
        )}

        {showAxis && (
          <div className="axisLeft">
            {LETTERS.map((l) => (
              <div key={l} className="axisLabel">
                {l}
              </div>
            ))}
          </div>
        )}

        <div className={interactive ? 'grid interactive' : 'grid'}>
          {Array.from({ length: BOARD_SIZE }).map((_, y) =>
            Array.from({ length: BOARD_SIZE }).map((__, x) => {
              const overlay = overlays?.[`${x},${y}`];
              const state = board[y]?.[x] ?? 'empty';

              const cellKey = `${x},${y}`;
              const hasShipImage = showShips && isShipLike(state);
              const shipImageUrl =
                hasShipImage && shipMeta?.startCells.has(cellKey) ? SHIP_IMAGE_START : SHIP_IMAGE_SECTION;

              const shipOrientation = shipMeta?.orientationByCell.get(cellKey) ?? 'vertical';
              const shipRotation = shipOrientation === 'horizontal' ? 'rotate(-90deg)' : 'rotate(0deg)';

              return (
                <button
                  key={`${x},${y}`}
                  className={cellClass(state, showShips, overlay) + (hasShipImage ? ' hasShipImg' : '')}
                  style={
                    hasShipImage
                      ? ({
                          ['--ship-img' as never]: `url(${shipImageUrl})`,
                          ['--ship-rot' as never]: shipRotation,
                        } as React.CSSProperties)
                      : undefined
                  }
                  onMouseEnter={() => onCellHover?.(x, y)}
                  onDragEnter={(e) => handleDragOver(e, x, y)}
                  onDragOver={(e) => handleDragOver(e, x, y)}
                  onDrop={(e) => handleDrop(e, x, y)}
                  onClick={() => onCellClick?.(x, y)}
                  disabled={!interactive}
                  aria-label={`cell-${x}-${y}`}
                />
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

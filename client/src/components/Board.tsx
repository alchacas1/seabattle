import type { DragEvent } from 'react';
import type { CellState } from '../game/types';
import { BOARD_SIZE } from '../game/board';
import './Board.css';

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
              return (
                <button
                  key={`${x},${y}`}
                  className={cellClass(board[y]?.[x] ?? 'empty', showShips, overlay)}
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

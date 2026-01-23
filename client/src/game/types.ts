export type CellState = 'empty' | 'ship' | 'hit' | 'miss';

export type Direction = 'horizontal' | 'vertical';

export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export const SHIP_SPECS: Record<ShipKind, { size: number; label: string }> = {
  carrier: { size: 5, label: 'Carrier (5)' },
  battleship: { size: 4, label: 'Battleship (4)' },
  cruiser: { size: 3, label: 'Cruiser (3)' },
  submarine: { size: 3, label: 'Submarine (3)' },
  destroyer: { size: 2, label: 'Destroyer (2)' },
};

export type Coord = { x: number; y: number };

export type CellState = 'empty' | 'ship' | 'hit' | 'miss';

export type Direction = 'horizontal' | 'vertical';

export const FLEET_KINDS = [
  's4_1',
  's3_1',
  's3_2',
  's2_1',
  's2_2',
  's2_3',
  's1_1',
  's1_2',
  's1_3',
  's1_4',
] as const;

export type ShipKind = (typeof FLEET_KINDS)[number];

export const SHIP_SPECS: Record<ShipKind, { size: number; label: string }> = {
  s4_1: { size: 4, label: '4x1' },
  s3_1: { size: 3, label: '3x1 (1)' },
  s3_2: { size: 3, label: '3x1 (2)' },
  s2_1: { size: 2, label: '2x1 (1)' },
  s2_2: { size: 2, label: '2x1 (2)' },
  s2_3: { size: 2, label: '2x1 (3)' },
  s1_1: { size: 1, label: '1x1 (1)' },
  s1_2: { size: 1, label: '1x1 (2)' },
  s1_3: { size: 1, label: '1x1 (3)' },
  s1_4: { size: 1, label: '1x1 (4)' },
};

export type Coord = { x: number; y: number };

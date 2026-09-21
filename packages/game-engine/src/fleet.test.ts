import { describe, expect, it } from "vitest";
import {
  autoPlaceFleet,
  validateFleet,
  validateShipPlacement,
} from "./index.js";

describe("fleet placement", () => {
  it("rejects overlap, adjacency, and cells outside the board", () => {
    const existing = [
      {
        id: "a",
        size: 2,
        orientation: "H" as const,
        cells: [
          { row: 2, col: 2 },
          { row: 2, col: 3 },
        ],
        hits: [],
        sunk: false,
      },
    ];

    expect(
      validateShipPlacement(existing, {
        id: "b",
        size: 1,
        orientation: "H",
        cells: [{ row: 2, col: 3 }],
        hits: [],
        sunk: false,
      }),
    ).toMatchObject({ valid: false, reason: "OVERLAP" });
    expect(
      validateShipPlacement(existing, {
        id: "b",
        size: 1,
        orientation: "H",
        cells: [{ row: 3, col: 4 }],
        hits: [],
        sunk: false,
      }),
    ).toMatchObject({ valid: false, reason: "ADJACENT" });
    expect(
      validateShipPlacement([], {
        id: "b",
        size: 2,
        orientation: "H",
        cells: [
          { row: 9, col: 9 },
          { row: 9, col: 10 },
        ],
        hits: [],
        sunk: false,
      }),
    ).toMatchObject({ valid: false, reason: "OUT_OF_BOUNDS" });
  });

  it("auto-places a valid classic fleet using an injectable random source", () => {
    let seed = 123456789;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const fleet = autoPlaceFleet(random);
    expect(fleet).toHaveLength(10);
    expect(fleet.flatMap((ship) => ship.cells)).toHaveLength(20);
    expect(validateFleet(fleet)).toEqual({ valid: true });
  });

  it("rejects a fleet with the wrong ship distribution", () => {
    const fleet = autoPlaceFleet(() => 0.42).slice(1);
    expect(validateFleet(fleet)).toMatchObject({
      valid: false,
      reason: "INVALID_DISTRIBUTION",
    });
  });
});

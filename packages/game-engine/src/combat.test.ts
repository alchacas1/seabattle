import { describe, expect, it } from "vitest";
import { attackCell, GameRuleError } from "./index.js";
import { coordinateKey, type Ship } from "@sea-battle/shared-types";

const fleet = (): Ship[] => [
  {
    id: "patrol",
    size: 1,
    orientation: "H",
    cells: [{ row: 1, col: 1 }],
    hits: [],
    sunk: false,
  },
  {
    id: "destroyer",
    size: 2,
    orientation: "V",
    cells: [
      { row: 4, col: 4 },
      { row: 5, col: 4 },
    ],
    hits: [],
    sunk: false,
  },
];

describe("basic combat", () => {
  it("returns MISS without exposing fleet data", () => {
    const outcome = attackCell(fleet(), new Set(), { row: 0, col: 0 });
    expect(outcome).toMatchObject({ result: "MISS", victory: false });
    expect(outcome).not.toHaveProperty("fleet");
  });

  it("marks a ship SUNK only when its final cell is hit", () => {
    const first = attackCell(fleet(), new Set(), { row: 4, col: 4 });
    expect(first.result).toBe("HIT");

    const second = attackCell(first.updatedFleet, new Set(["4-4"]), {
      row: 5,
      col: 4,
    });
    expect(second).toMatchObject({
      result: "SUNK",
      sunkShipSize: 2,
      sunkShipCells: [
        { row: 4, col: 4 },
        { row: 5, col: 4 },
      ],
      victory: false,
    });
  });

  it("reveals the unattacked water immediately surrounding a sunk ship", () => {
    const edgeShip: Ship = {
      id: "edge-destroyer",
      size: 2,
      orientation: "H",
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
      hits: [{ row: 0, col: 0 }],
      sunk: false,
    };

    const outcome = attackCell([edgeShip], new Set(["0-0", "1-0"]), {
      row: 0,
      col: 1,
    });

    expect(outcome.result).toBe("SUNK");
    expect(outcome.revealedWater.map(coordinateKey).sort()).toEqual([
      "0-2",
      "1-1",
      "1-2",
    ]);
  });

  it("detects victory after the last surviving ship sinks", () => {
    const ships = fleet();
    ships[1] = { ...ships[1]!, hits: [...ships[1]!.cells], sunk: true };
    expect(
      attackCell(ships, new Set(["4-4", "5-4"]), { row: 1, col: 1 }),
    ).toMatchObject({
      result: "SUNK",
      victory: true,
    });
  });

  it("rejects duplicate and out-of-range attacks", () => {
    expect(() =>
      attackCell(fleet(), new Set(["1-1"]), { row: 1, col: 1 }),
    ).toThrowError(new GameRuleError("CELL_ALREADY_ATTACKED"));
    expect(() =>
      attackCell(fleet(), new Set(), { row: -1, col: 3 }),
    ).toThrowError(new GameRuleError("INVALID_COORDINATE"));
  });
});

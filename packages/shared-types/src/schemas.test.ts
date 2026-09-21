import { describe, expect, it } from "vitest";
import {
  attackInputSchema,
  createRoomInputSchema,
  fleetSchema,
  joinRoomInputSchema,
} from "./index.js";

describe("callable payload schemas", () => {
  it("normalizes player names and room codes", () => {
    expect(
      createRoomInputSchema.parse({ playerName: "  Álvaro   Chaves " }),
    ).toEqual({
      playerName: "Álvaro Chaves",
    });
    expect(
      joinRoomInputSchema.parse({
        playerName: " Anders ",
        roomCode: " k7f2qx ",
      }),
    ).toEqual({
      playerName: "Anders",
      roomCode: "K7F2QX",
    });
  });

  it("rejects malformed coordinates and non-UUID action ids", () => {
    expect(
      attackInputSchema.safeParse({
        gameId: "game",
        actionId: "retry-1",
        row: 10,
        col: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts a structurally complete classic fleet", () => {
    const ships = [
      {
        id: "carrier",
        size: 4,
        orientation: "H",
        cells: [0, 1, 2, 3].map((col) => ({ row: 0, col })),
      },
      {
        id: "cruiser-1",
        size: 3,
        orientation: "H",
        cells: [0, 1, 2].map((col) => ({ row: 2, col })),
      },
      {
        id: "cruiser-2",
        size: 3,
        orientation: "H",
        cells: [0, 1, 2].map((col) => ({ row: 4, col })),
      },
      ...[0, 2, 4].map((row, index) => ({
        id: `destroyer-${index}`,
        size: 2,
        orientation: "V",
        cells: [
          { row, col: 5 },
          { row: row + 1, col: 5 },
        ],
      })),
      ...[0, 2, 4, 6].map((row, index) => ({
        id: `boat-${index}`,
        size: 1,
        orientation: "H",
        cells: [{ row, col: 8 }],
      })),
    ];

    expect(fleetSchema.parse(ships)).toHaveLength(10);
  });
});

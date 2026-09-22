// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameBoard } from "./GameBoard";

describe("GameBoard", () => {
  it("renders the nautical tile artwork in every playable cell", () => {
    render(<GameBoard mode="own" />);

    const cells = screen.getAllByRole("gridcell");
    expect(cells).toHaveLength(100);
    cells.forEach((cell) => {
      const tile = cell.querySelector<HTMLElement>(".board-cell__tile");
      expect(tile).not.toBeNull();
      expect(tile?.style.backgroundImage).toContain("tablero.png");
    });
  });

  it("uses start and body artwork with the ship orientation and sunk state", () => {
    render(
      <GameBoard
        mode="own"
        attackedCells={{ "2-2": "HIT", "3-2": "HIT" }}
        ships={[
          {
            id: "horizontal",
            size: 2,
            orientation: "H",
            cells: [
              { row: 0, col: 0 },
              { row: 0, col: 1 },
            ],
            hits: [],
            sunk: false,
          },
          {
            id: "vertical-destroyed",
            size: 2,
            orientation: "V",
            cells: [
              { row: 2, col: 2 },
              { row: 3, col: 2 },
            ],
            hits: [
              { row: 2, col: 2 },
              { row: 3, col: 2 },
            ],
            sunk: true,
          },
        ]}
      />,
    );

    const horizontalStart = screen
      .getByRole("gridcell", { name: "A1, barco propio" })
      .querySelector<HTMLElement>(".board-cell__ship");
    const horizontalBody = screen
      .getByRole("gridcell", { name: "A2, barco propio" })
      .querySelector<HTMLElement>(".board-cell__ship");
    const verticalStart = screen
      .getByRole("gridcell", { name: "C3, barco hundido" })
      .querySelector<HTMLElement>(".board-cell__ship");
    const verticalBody = screen
      .getByRole("gridcell", { name: "D3, barco hundido" })
      .querySelector<HTMLElement>(".board-cell__ship");

    expect(horizontalStart?.style.backgroundImage).toContain("ini.png");
    expect(horizontalStart?.style.transform).toBe("rotate(0deg)");
    expect(horizontalBody?.style.backgroundImage).toContain("base.png");
    expect(horizontalBody?.style.transform).toBe("rotate(0deg)");
    expect(verticalStart?.style.backgroundImage).toContain("iniD.png");
    expect(verticalStart?.style.transform).toBe("rotate(90deg)");
    expect(verticalBody?.style.backgroundImage).toContain("baseD.png");
    expect(verticalBody?.style.transform).toBe("rotate(90deg)");
  });

  it("exposes coordinates and selects an enemy target without attacking immediately", () => {
    const onSelect = vi.fn();
    render(
      <GameBoard
        mode="enemy"
        attackedCells={{ "1-1": "MISS" }}
        selected={null}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("button", { name: "B2, agua" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "E5, desconocido" }));
    expect(onSelect).toHaveBeenCalledWith({ row: 4, col: 4 });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows own ships and does not rely on color alone", () => {
    render(
      <GameBoard
        mode="own"
        attackedCells={{ "0-0": "HIT" }}
        ships={[
          {
            id: "one",
            size: 1,
            orientation: "H",
            cells: [{ row: 0, col: 0 }],
            hits: [{ row: 0, col: 0 }],
            sunk: true,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("gridcell", { name: "A1, barco hundido" }),
    ).toHaveTextContent("🔥");
  });
});

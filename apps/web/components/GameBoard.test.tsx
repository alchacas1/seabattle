// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameBoard } from "./GameBoard";

describe("GameBoard", () => {
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

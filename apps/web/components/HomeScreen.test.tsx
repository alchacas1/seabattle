// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen";

afterEach(cleanup);

describe("HomeScreen", () => {
  it("shows empty name and room-code inputs without preloaded examples", () => {
    render(
      <HomeScreen
        busy={false}
        resumableGameId={null}
        onCreate={vi.fn()}
        onJoin={vi.fn()}
        onResume={vi.fn()}
      />,
    );

    const name = screen.getByLabelText("Nombre del capitán");
    const roomCode = screen.getByLabelText("Código de sala");

    expect(name).toHaveValue("");
    expect(name).not.toHaveAttribute("placeholder");
    expect(name).toHaveAttribute("autocomplete", "off");
    expect(roomCode).toHaveValue("");
    expect(roomCode).not.toHaveAttribute("placeholder");
    expect(roomCode).toHaveAttribute("autocomplete", "off");
  });

  it("joins the entered room when the form is submitted with a room code", () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(
      <HomeScreen
        busy={false}
        resumableGameId={null}
        onCreate={onCreate}
        onJoin={onJoin}
        onResume={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nombre del capitán"), {
      target: { value: "Anders" },
    });
    fireEvent.change(screen.getByLabelText("Código de sala"), {
      target: { value: "K7F2QX" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear partida" }).closest("form")!,
    );
    expect(onJoin).toHaveBeenCalledWith("Anders", "K7F2QX");
    expect(onCreate).not.toHaveBeenCalled();
  });
});

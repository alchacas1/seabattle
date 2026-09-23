// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type {
  PlayerState,
  PublicBoard,
  PublicGameState,
} from "@sea-battle/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BattleScreen } from "./BattleScreen";

const game: PublicGameState = {
  id: "game-1",
  roomCode: "K7F2QX",
  status: "PLAYING",
  player1Id: "captain",
  player2Id: "rival",
  currentTurnPlayerId: "captain",
  turnNumber: 4,
  turnStartedAt: 10_000,
  turnEndsAt: null,
  winnerId: null,
  rules: { keepTurnOnHit: true, turnSeconds: 30 },
  createdAt: 1_000,
  updatedAt: 10_000,
  seriesId: "series-1",
};

const inventory = {
  fighter: 0,
  attackPlane: 0,
  torpedoPlane: 0,
  torpedoSquadron: 0,
  bomber: 0,
  nuclear: 0,
  antiAir: 0,
  mine: 0,
  submarine: 0,
  radar: 0,
};

const players: Record<string, PlayerState> = {
  captain: {
    uid: "captain",
    name: "Capitán",
    ready: true,
    fleetConfirmed: true,
    joinedAt: 1_000,
    energy: 0,
    inventory,
  },
  rival: {
    uid: "rival",
    name: "Rival",
    ready: true,
    fleetConfirmed: true,
    joinedAt: 2_000,
    energy: 0,
    inventory,
  },
};

const boards: Record<string, PublicBoard> = {
  captain: { ownerId: "captain", attackedCells: {} },
  rival: { ownerId: "rival", attackedCells: {} },
};

const originalRequestFullscreen = Object.getOwnPropertyDescriptor(
  document.documentElement,
  "requestFullscreen",
);
const originalOrientation = Object.getOwnPropertyDescriptor(
  window.screen,
  "orientation",
);

const battleScreen = (
  onAttack: (coordinate: { row: number; col: number }) => Promise<void>,
  gameState: PublicGameState = game,
  boardState: Record<string, PublicBoard> = boards,
) => (
  <BattleScreen
    game={gameState}
    uid="captain"
    players={players}
    boards={boardState}
    ownFleet={[]}
    events={[]}
    serverOffset={0}
    onAttack={onAttack}
  />
);

const renderBattle = (
  onAttack: (coordinate: { row: number; col: number }) => Promise<void>,
  gameState: PublicGameState = game,
  boardState: Record<string, PublicBoard> = boards,
) => render(battleScreen(onAttack, gameState, boardState));

afterEach(() => {
  cleanup();
  if (originalRequestFullscreen) {
    Object.defineProperty(
      document.documentElement,
      "requestFullscreen",
      originalRequestFullscreen,
    );
  } else {
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  }
  if (originalOrientation) {
    Object.defineProperty(window.screen, "orientation", originalOrientation);
  } else {
    Reflect.deleteProperty(window.screen, "orientation");
  }
});

describe("BattleScreen", () => {
  it("attacks an available enemy cell with one tap", () => {
    const onAttack = vi.fn().mockResolvedValue(undefined);
    renderBattle(onAttack);

    fireEvent.click(screen.getByRole("button", { name: "E5, desconocido" }));

    expect(onAttack).toHaveBeenCalledWith({ row: 4, col: 4 });
    expect(
      screen.queryByRole("button", { name: /Atacar/ }),
    ).not.toBeInTheDocument();
  });

  it("blocks additional targets while an attack is pending", () => {
    let finishAttack: (() => void) | undefined;
    const onAttack = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishAttack = resolve;
        }),
    );
    renderBattle(onAttack);

    fireEvent.click(screen.getByRole("button", { name: "E5, desconocido" }));

    expect(screen.getByRole("status")).toHaveTextContent("Atacando...");
    const secondTarget = screen.getByRole("button", {
      name: "E6, desconocido",
    });
    expect(secondTarget).toBeDisabled();
    fireEvent.click(secondTarget);
    expect(onAttack).toHaveBeenCalledTimes(1);

    finishAttack?.();
  });

  it("keeps targets locked until the board snapshot confirms the attack", async () => {
    const onAttack = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderBattle(onAttack);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "E5, desconocido" }));
    });

    expect(
      screen.getByRole("button", { name: "E6, desconocido" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Atacando...");

    rerender(
      battleScreen(onAttack, game, {
        ...boards,
        rival: { ownerId: "rival", attackedCells: { "4-4": "HIT" } },
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "E6, desconocido" }),
      ).toBeEnabled(),
    );
  });

  it("stays locked when a retained-turn game snapshot arrives before the board", async () => {
    const onAttack = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderBattle(onAttack);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "E5, desconocido" }));
    });
    rerender(battleScreen(onAttack, { ...game, turnNumber: 5 }));

    expect(
      screen.getByRole("button", { name: "E6, desconocido" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Atacando...");
  });

  it("points the turn indicator toward the active player's board", () => {
    const onAttack = vi.fn().mockResolvedValue(undefined);
    const rivalTurn = { ...game, currentTurnPlayerId: "rival" };
    const { rerender } = renderBattle(onAttack, rivalTurn);

    expect(screen.getByLabelText("Turno actual: Rival")).toHaveAttribute(
      "data-active-board",
      "enemy",
    );

    rerender(battleScreen(onAttack));
    expect(screen.getByLabelText("Turno actual: Capitán")).toHaveAttribute(
      "data-active-board",
      "own",
    );
  });

  it("keeps both boards available without a mobile fleet toggle", () => {
    renderBattle(vi.fn().mockResolvedValue(undefined));

    expect(
      screen.getByRole("heading", { name: "Tu flota" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Flota enemiga" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mi flota/i }),
    ).not.toBeInTheDocument();
  });

  it("requests fullscreen landscape mode from the rotation control", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const lock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(window.screen, "orientation", {
      configurable: true,
      value: { lock },
    });
    renderBattle(vi.fn().mockResolvedValue(undefined));

    fireEvent.click(
      screen.getByRole("button", { name: "Activar vista horizontal" }),
    );

    await waitFor(() => {
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      expect(lock).toHaveBeenCalledWith("landscape");
    });
    expect(screen.getByText("Vista horizontal activada")).toBeInTheDocument();
  });
});

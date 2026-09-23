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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameApp } from "./GameApp";
import { useGameStore } from "@/stores/game-store";
import { attackCell } from "@/services/game-service";

vi.mock("@/services/game-service", () => ({
  attackCell: vi.fn(),
  confirmFleet: vi.fn(),
  createRoom: vi.fn(),
  ensureAnonymousAuth: (onAuthenticated: (user: { uid: string }) => void) => {
    void onAuthenticated({ uid: "test-user" });
    return vi.fn();
  },
  getAutoFleet: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  requestRematch: vi.fn(),
  subscribePresence: vi.fn(() => vi.fn()),
  subscribeToGame: vi.fn(() => vi.fn()),
  syncGame: vi.fn().mockResolvedValue({
    gameId: null,
    serverTime: 1_700_000_000_000,
  }),
  trackPresence: vi.fn(() => vi.fn()),
}));

describe("GameApp", () => {
  beforeEach(() => {
    useGameStore.setState({
      uid: null,
      gameId: null,
      resumableGameId: null,
      game: null,
      players: {},
      boards: {},
      events: [],
      ownFleet: [],
      connected: true,
      rivalOnline: null,
    });
    vi.mocked(attackCell).mockReset();
  });

  afterEach(cleanup);

  it("shows the semantic application version in the footer", async () => {
    render(<GameApp />);

    expect(
      await screen.findByText(/SEA BATTLE · v\d+\.\d+\.\d+/),
    ).toBeInTheDocument();
  });

  it("unlocks attack targets after the attack request fails", async () => {
    vi.mocked(attackCell).mockRejectedValueOnce(new Error("attack failed"));
    render(<GameApp />);
    await screen.findByText(/SEA BATTLE/);

    await act(async () => {
      useGameStore.setState({
        uid: "test-user",
        gameId: "game-1",
        game: {
          id: "game-1",
          roomCode: "K7F2QX",
          status: "PLAYING",
          player1Id: "test-user",
          player2Id: "rival",
          currentTurnPlayerId: "test-user",
          turnNumber: 4,
          turnStartedAt: 10_000,
          turnEndsAt: null,
          winnerId: null,
          rules: { keepTurnOnHit: true, turnSeconds: 30 },
          createdAt: 1_000,
          updatedAt: 10_000,
          seriesId: "series-1",
        },
        players: {
          "test-user": {
            uid: "test-user",
            name: "Capitán",
            ready: true,
            fleetConfirmed: true,
            joinedAt: 1_000,
            energy: 0,
            inventory: {
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
            },
          },
          rival: {
            uid: "rival",
            name: "Rival",
            ready: true,
            fleetConfirmed: true,
            joinedAt: 2_000,
            energy: 0,
            inventory: {
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
            },
          },
        },
        boards: {
          "test-user": { ownerId: "test-user", attackedCells: {} },
          rival: { ownerId: "rival", attackedCells: {} },
        },
        events: [],
        ownFleet: [],
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "E5, desconocido" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: "E6, desconocido" }),
    ).toBeEnabled();
  });
});

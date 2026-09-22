// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameApp } from "./GameApp";
import { useGameStore } from "@/stores/game-store";

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
  });

  it("shows the semantic application version in the footer", async () => {
    render(<GameApp />);

    expect(
      await screen.findByText(/SEA BATTLE · v\d+\.\d+\.\d+/),
    ).toBeInTheDocument();
  });
});

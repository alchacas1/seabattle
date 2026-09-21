// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TurnTimer } from "./TurnTimer";

describe("TurnTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses the server offset and reaches zero without writing state remotely", () => {
    vi.setSystemTime(10_000);
    render(
      <TurnTimer turnEndsAt={42_000} serverOffset={2_000} totalSeconds={30} />,
    );
    expect(screen.getByText("30 s")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(29_000));
    expect(screen.getByText("1 s")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("0 s")).toBeInTheDocument();
  });
});

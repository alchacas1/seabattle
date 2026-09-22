import { describe, expect, it } from "vitest";
import { readableError } from "./error-message";

describe("readableError", () => {
  it("uses the Firebase callable code instead of falling back to a generic message", () => {
    const error = Object.assign(new Error("TURN_EXPIRED"), {
      code: "functions/deadline-exceeded",
    });

    expect(readableError(error)).toBe("El turno ya terminó.");
  });

  it("preserves the domain reason when Firebase reports a failed precondition", () => {
    const error = Object.assign(new Error("NOT_YOUR_TURN"), {
      code: "functions/failed-precondition",
    });

    expect(readableError(error)).toBe("No es tu turno.");
  });
});

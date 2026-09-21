import { HttpsError } from "firebase-functions/v2/https";
import { ZodError } from "zod";
import { DomainError } from "./game/commands.js";

const codeMap: Record<string, ConstructorParameters<typeof HttpsError>[0]> = {
  UNAUTHENTICATED: "unauthenticated",
  GAME_NOT_FOUND: "not-found",
  ROOM_NOT_FOUND: "not-found",
  NOT_A_PLAYER: "permission-denied",
  NOT_YOUR_TURN: "failed-precondition",
  TURN_EXPIRED: "deadline-exceeded",
  RATE_LIMITED: "resource-exhausted",
  ROOM_FULL: "resource-exhausted",
  REMATCH_NOT_AVAILABLE: "failed-precondition",
  ACTION_ID_REUSED: "already-exists",
  CELL_ALREADY_ATTACKED: "already-exists",
};

export function asHttpsError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof ZodError)
    throw new HttpsError(
      "invalid-argument",
      "Payload inválido",
      error.flatten(),
    );
  if (error instanceof DomainError)
    throw new HttpsError(
      codeMap[error.code] ?? "failed-precondition",
      error.code,
    );
  if (error instanceof Error && error.message in codeMap) {
    throw new HttpsError(codeMap[error.message]!, error.message);
  }
  console.error(error);
  throw new HttpsError("internal", "Error interno");
}

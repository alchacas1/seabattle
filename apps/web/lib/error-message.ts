const codeLabels: Record<string, string> = {
  "not-found": "No encontramos esa sala.",
  "resource-exhausted": "La sala está llena o hubo demasiados intentos.",
  "failed-precondition": "La acción ya no es válida. Sincronizamos el tablero.",
  "deadline-exceeded": "El turno ya terminó.",
  "already-exists": "Esa coordenada ya fue atacada.",
};

const reasonLabels: Record<string, string> = {
  NOT_YOUR_TURN: "No es tu turno.",
  TURN_EXPIRED: "El turno ya terminó.",
  CELL_ALREADY_ATTACKED: "Esa coordenada ya fue atacada.",
};

export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const reason = reasonLabels[message];
  if (reason) return reason;

  const firebaseCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code.replace(/^functions\//, "")
      : null;
  const messageCode = message.match(/functions\/([a-z-]+)/)?.[1] ?? null;
  return (
    codeLabels[firebaseCode ?? messageCode ?? ""] ??
    "No pudimos completar la maniobra. Intenta de nuevo."
  );
}

import type {
  GameEvent,
  PlayerState,
  PublicGameState,
} from "@sea-battle/shared-types";

export function ResultScreen({
  game,
  uid,
  players,
  events,
  rematchPending,
  onRematch,
  onExit,
}: {
  game: PublicGameState;
  uid: string;
  players: Record<string, PlayerState>;
  events: GameEvent[];
  rematchPending: boolean;
  onRematch: () => void;
  onExit: () => void;
}) {
  const eventAttacks = events.filter(
    (item) => item.type === "ATTACK" && item.actorId === uid,
  );
  const stats = players[uid]?.stats;
  const attackCount = stats?.attacks ?? eventAttacks.length;
  const hits =
    stats?.hits ??
    eventAttacks.filter(
      (item) => item.payload.result === "HIT" || item.payload.result === "SUNK",
    ).length;
  const misses = stats?.misses ?? attackCount - hits;
  const accuracy = attackCount ? Math.round((hits / attackCount) * 100) : 0;
  const won = game.winnerId === uid;
  return (
    <main className="center-screen result-screen">
      <p className="eyebrow">Parte de batalla</p>
      <h1>
        {won
          ? "Victoria"
          : game.status === "ABANDONED"
            ? "Partida abandonada"
            : "Derrota"}
      </h1>
      <p>
        {won
          ? `${players[uid]?.name ?? "Capitán"}, tu flota domina estas aguas.`
          : "El océano recordará esta batalla."}
      </p>
      <section className="stats-grid">
        <div>
          <strong>{game.turnNumber}</strong>
          <span>turnos</span>
        </div>
        <div>
          <strong>{attackCount}</strong>
          <span>ataques</span>
        </div>
        <div>
          <strong>{hits}</strong>
          <span>impactos</span>
        </div>
        <div>
          <strong>{misses}</strong>
          <span>fallos</span>
        </div>
        <div>
          <strong>{accuracy}%</strong>
          <span>precisión</span>
        </div>
      </section>
      <div className="button-row">
        <button
          className="button button--primary"
          disabled={rematchPending}
          type="button"
          onClick={onRematch}
        >
          {rematchPending ? "Esperando al rival…" : "Revancha"}
        </button>
        <button
          className="button button--outline"
          type="button"
          onClick={onExit}
        >
          Salir
        </button>
      </div>
    </main>
  );
}

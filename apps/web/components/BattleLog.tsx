import type { GameEvent, PlayerState } from "@sea-battle/shared-types";

const eventLabels: Partial<Record<GameEvent["type"], string>> = {
  GAME_CREATED: "Partida creada",
  PLAYER_JOINED: "El rival se unió",
  FLEET_CONFIRMED: "Flota confirmada",
  GAME_STARTED: "¡Comienza la batalla!",
  TURN_TIMEOUT: "Turno agotado",
  GAME_FINISHED: "Partida finalizada",
  WEAPON_USED: "Arma utilizada",
};

export function BattleLog({
  events,
  players,
}: {
  events: GameEvent[];
  players: Record<string, PlayerState>;
}) {
  return (
    <section className="paper-panel battle-log" aria-label="Historial">
      <h2>Bitácora</h2>
      {events.length === 0 ? (
        <p className="muted">Todavía no hay movimientos.</p>
      ) : (
        <ol>
          {events.map((item) => {
            const actor = item.actorId ? players[item.actorId]?.name : null;
            const attack =
              item.type === "ATTACK"
                ? `${String(item.payload.row)}-${String(item.payload.col)}: ${String(item.payload.result).toLowerCase()}`
                : null;
            return (
              <li key={item.id}>
                <time>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>{" "}
                {actor && <strong>{actor}: </strong>}
                {attack ?? eventLabels[item.type] ?? item.type}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

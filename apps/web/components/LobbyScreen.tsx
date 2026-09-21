import type { PlayerState, PublicGameState } from "@sea-battle/shared-types";

export function LobbyScreen({
  game,
  players,
  uid,
}: {
  game: PublicGameState;
  players: Record<string, PlayerState>;
  uid: string;
}) {
  const me = players[uid];
  return (
    <main className="center-screen">
      <p className="eyebrow">Sala de espera</p>
      <h1>{game.roomCode}</h1>
      <button
        className="copy-code"
        type="button"
        onClick={() => void navigator.clipboard.writeText(game.roomCode)}
      >
        Copiar código
      </button>
      <section className="paper-panel lobby-card">
        <div className="player-line">
          <span className="status-dot status-dot--online" />{" "}
          <strong>{me?.name ?? "Capitán"}</strong>
          <span>Listo</span>
        </div>
        <div className="player-line">
          <span className="status-dot" /> <strong>Segundo capitán</strong>
          <span className="muted">Esperando…</span>
        </div>
      </section>
      <div className="sonar" aria-label="Buscando rival">
        <span />
        <span />
        <span />
      </div>
      <p className="muted">
        Comparte el código. La batalla empieza cuando llegue tu rival.
      </p>
    </main>
  );
}

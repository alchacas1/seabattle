"use client";

import { useState, type FormEvent } from "react";

interface HomeScreenProps {
  busy: boolean;
  resumableGameId: string | null;
  onCreate: (name: string) => Promise<void>;
  onJoin: (name: string, roomCode: string) => Promise<void>;
  onResume: () => Promise<void>;
}

export function HomeScreen({
  busy,
  resumableGameId,
  onCreate,
  onJoin,
  onResume,
}: HomeScreenProps) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const submit = (event: FormEvent, action: () => Promise<void>) => {
    event.preventDefault();
    void action();
  };
  return (
    <main className="home-screen">
      <div className="hero-mark" aria-hidden="true">
        ⚓
      </div>
      <p className="eyebrow">Cuaderno de mando</p>
      <h1>Sea Battle</h1>
      <p className="hero-copy">
        Dos capitanes. Cien coordenadas. Una sola flota a flote.
      </p>

      {resumableGameId && (
        <section className="resume-card">
          <div>
            <strong>Tienes una partida activa</strong>
            <span>Tu puesto de mando sigue esperando.</span>
          </div>
          <button
            className="button button--ink"
            type="button"
            disabled={busy}
            onClick={() => void onResume()}
          >
            Reanudar
          </button>
        </section>
      )}

      <form
        className="paper-panel command-card"
        onSubmit={(event) =>
          submit(event, () =>
            roomCode.trim() ? onJoin(name, roomCode) : onCreate(name),
          )
        }
      >
        <label>
          Nombre del capitán
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={32}
            required
            autoComplete="off"
          />
        </label>
        <button
          className="button button--primary"
          disabled={busy}
          type="button"
          onClick={() => void onCreate(name)}
        >
          Crear partida
        </button>
        <div className="divider">
          <span>o únete a una sala</span>
        </div>
        <label>
          Código de sala
          <input
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            minLength={6}
            maxLength={6}
            pattern="[A-HJ-KM-NP-Z2-9]{6}"
            autoComplete="off"
          />
        </label>
        <button
          className="button button--outline"
          disabled={busy || roomCode.length !== 6 || name.trim().length < 2}
          type="button"
          onClick={() => void onJoin(name, roomCode)}
        >
          Unirse
        </button>
      </form>
    </main>
  );
}

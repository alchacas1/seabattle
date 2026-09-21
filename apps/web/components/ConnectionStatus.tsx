export function ConnectionStatus({
  connected,
  rivalOnline,
}: {
  connected: boolean;
  rivalOnline: boolean | null;
}) {
  const ownLabel = connected ? "Conectado" : "Reconectando…";
  return (
    <div className="connection-status" aria-live="polite">
      <span
        className={connected ? "status-dot status-dot--online" : "status-dot"}
        aria-hidden="true"
      />
      {ownLabel}
      {rivalOnline !== null && (
        <span> · Rival {rivalOnline ? "conectado" : "desconectado"}</span>
      )}
    </div>
  );
}

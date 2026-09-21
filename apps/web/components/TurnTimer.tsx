"use client";

import { useEffect, useMemo, useState } from "react";

interface TurnTimerProps {
  turnEndsAt: number | null;
  serverOffset: number;
  totalSeconds?: number;
}

const calculateRemaining = (
  turnEndsAt: number | null,
  serverOffset: number,
  now: number,
): number =>
  turnEndsAt === null
    ? 0
    : Math.max(0, Math.ceil((turnEndsAt - (now + serverOffset)) / 1000));

export function TurnTimer({
  turnEndsAt,
  serverOffset,
  totalSeconds = 30,
}: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = calculateRemaining(turnEndsAt, serverOffset, now);
  const urgency =
    remaining <= 5 ? "critical" : remaining <= 10 ? "warning" : "normal";
  const width = useMemo(
    () => Math.min(100, (remaining / totalSeconds) * 100),
    [remaining, totalSeconds],
  );
  return (
    <div className={`turn-timer turn-timer--${urgency}`} aria-live="polite">
      <div className="turn-timer__track" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      <strong>{remaining} s</strong>
    </div>
  );
}

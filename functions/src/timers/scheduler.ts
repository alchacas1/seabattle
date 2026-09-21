import { getFunctions } from "firebase-admin/functions";

interface TurnTask {
  gameId: string;
  turnNumber: number;
}

export async function scheduleTurnTimeout(
  task: TurnTask,
  turnEndsAt: number,
): Promise<void> {
  const delaySeconds = Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000));
  await getFunctions().taskQueue("handleTurnTimeout").enqueue(task, {
    scheduleDelaySeconds: delaySeconds,
  });
}

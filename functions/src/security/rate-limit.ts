import type { Firestore, Transaction } from "firebase-admin/firestore";
import { DomainError } from "../game/commands.js";

const WINDOW_MILLIS = 1_000;
const MAX_ACTIONS_PER_WINDOW = 15;

export async function prepareRateLimit(
  firestore: Firestore,
  transaction: Transaction,
  uid: string,
  now: number,
): Promise<() => void> {
  const reference = firestore.collection("rateLimits").doc(uid);
  const snapshot = await transaction.get(reference);
  const data = snapshot.data() as
    | { windowStartedAt?: number; count?: number }
    | undefined;
  const sameWindow =
    data?.windowStartedAt !== undefined &&
    now - data.windowStartedAt < WINDOW_MILLIS;
  const count = sameWindow ? (data?.count ?? 0) + 1 : 1;
  if (count > MAX_ACTIONS_PER_WINDOW) throw new DomainError("RATE_LIMITED");
  return () =>
    transaction.set(
      reference,
      { windowStartedAt: sameWindow ? data!.windowStartedAt : now, count },
      { merge: true },
    );
}

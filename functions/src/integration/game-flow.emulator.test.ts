import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from "firebase/functions";
import type { Ship } from "@sea-battle/shared-types";

const runIntegration = process.env.RUN_FIREBASE_INTEGRATION === "true";
const suite = runIntegration ? describe : describe.skip;

interface Client {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
}

const createClient = (name: string): Client => {
  const app = initializeApp(
    { projectId: "demo-sea-battle", apiKey: "demo-key", appId: `demo-${name}` },
    name,
  );
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const functions = getFunctions(app, "us-central1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  return { app, auth, firestore, functions };
};

const call = async <Result>(
  client: Client,
  name: string,
  data: unknown,
): Promise<Result> =>
  (await httpsCallable<unknown, Result>(client.functions, name)(data)).data;

suite("complete emulated two-player flow", () => {
  let one: Client;
  let two: Client;

  beforeAll(async () => {
    one = createClient("captain-one");
    two = createClient("captain-two");
    await Promise.all([
      signInAnonymously(one.auth),
      signInAnonymously(two.auth),
    ]);
  });

  afterAll(async () => {
    await Promise.all([deleteApp(one.app), deleteApp(two.app)]);
  });

  it("creates, joins, protects secrets, plays to victory, and creates a fresh rematch", async () => {
    const created = await call<{ gameId: string; roomCode: string }>(
      one,
      "createRoom",
      { playerName: "Capitán Uno" },
    );
    expect(created.roomCode).toMatch(/^[A-HJ-KM-NP-Z2-9]{6}$/);
    await call(two, "joinRoom", {
      playerName: "Capitán Dos",
      roomCode: created.roomCode,
    });

    const [autoOne, autoTwo] = await Promise.all([
      call<{ fleet: Ship[] }>(one, "autoPlaceFleet", {
        gameId: created.gameId,
      }),
      call<{ fleet: Ship[] }>(two, "autoPlaceFleet", {
        gameId: created.gameId,
      }),
    ]);
    await call(one, "confirmFleet", {
      gameId: created.gameId,
      actionId: randomUUID(),
      fleet: autoOne.fleet,
    });
    await call(two, "confirmFleet", {
      gameId: created.gameId,
      actionId: randomUUID(),
      fleet: autoTwo.fleet,
    });

    const gameAfterStart = await getDoc(
      doc(one.firestore, "games", created.gameId),
    );
    expect(gameAfterStart.get("status")).toBe("PLAYING");
    expect(gameAfterStart.get("turnNumber")).toBe(1);
    await expect(
      getDoc(
        doc(
          one.firestore,
          "privateGameData",
          created.gameId,
          "boards",
          one.auth.currentUser!.uid,
        ),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });

    const syncedTwo = await call<{ ownFleet: Ship[] }>(two, "syncGame", {
      gameId: created.gameId,
    });
    const targets = syncedTwo.ownFleet.flatMap((ship) => ship.cells);
    const firstActionId = randomUUID();
    const firstTarget = targets[0]!;
    const first = await call<{ result: string }>(one, "attack", {
      gameId: created.gameId,
      actionId: firstActionId,
      ...firstTarget,
    });
    expect(first.result).toMatch(/HIT|SUNK/);
    const retry = await call<{ result: string }>(one, "attack", {
      gameId: created.gameId,
      actionId: firstActionId,
      ...firstTarget,
    });
    expect(retry).toEqual(first);

    for (const target of targets.slice(1, 10)) {
      await call(one, "attack", {
        gameId: created.gameId,
        actionId: randomUUID(),
        ...target,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1_050));
    for (const target of targets.slice(10)) {
      await call(one, "attack", {
        gameId: created.gameId,
        actionId: randomUUID(),
        ...target,
      });
    }

    const finished = await getDoc(doc(one.firestore, "games", created.gameId));
    expect(finished.get("status")).toBe("FINISHED");
    expect(finished.get("winnerId")).toBe(one.auth.currentUser!.uid);

    const waiting = await call<{ ready: boolean; gameId: string | null }>(
      one,
      "requestRematch",
      { gameId: created.gameId, actionId: randomUUID() },
    );
    expect(waiting).toEqual(
      expect.objectContaining({ ready: false, gameId: null }),
    );
    const rematch = await call<{ ready: boolean; gameId: string }>(
      two,
      "requestRematch",
      { gameId: created.gameId, actionId: randomUUID() },
    );
    expect(rematch.ready).toBe(true);
    expect(rematch.gameId).not.toBe(created.gameId);
    expect(
      (await getDoc(doc(one.firestore, "games", rematch.gameId))).get("status"),
    ).toBe("PLACING_SHIPS");
  }, 120_000);
});

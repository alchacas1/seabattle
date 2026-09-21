import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let environment: RulesTestEnvironment;
const rulesSuite = process.env.FIRESTORE_EMULATOR_HOST
  ? describe
  : describe.skip;

rulesSuite("Firestore security boundaries", () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: "demo-sea-battle",
      firestore: {
        rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "games/game-1"), {
        player1Id: "one",
        player2Id: "two",
        status: "PLAYING",
      });
      await setDoc(doc(db, "games/game-1/players/one"), {
        uid: "one",
        name: "One",
      });
      await setDoc(doc(db, "games/game-1/publicBoards/two"), {
        ownerId: "two",
        attackedCells: {},
      });
      await setDoc(doc(db, "privateGameData/game-1/boards/one"), {
        ownerId: "one",
        ships: [{ id: "secret" }],
      });
      await setDoc(doc(db, "activeGames/one"), { gameId: "game-1" });
    });
  });

  afterAll(async () => environment.cleanup());

  it("lets participants read public game data", async () => {
    const db = environment.authenticatedContext("one").firestore();
    await assertSucceeds(getDoc(doc(db, "games/game-1")));
    await assertSucceeds(getDoc(doc(db, "games/game-1/publicBoards/two")));
  });

  it("blocks unauthenticated users and outsiders", async () => {
    await assertFails(
      getDoc(
        doc(environment.unauthenticatedContext().firestore(), "games/game-1"),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          environment.authenticatedContext("outsider").firestore(),
          "games/game-1",
        ),
      ),
    );
  });

  it("blocks every client from private boards, including their own", async () => {
    await assertFails(
      getDoc(
        doc(
          environment.authenticatedContext("one").firestore(),
          "privateGameData/game-1/boards/one",
        ),
      ),
    );
  });

  it("blocks direct writes to authoritative and public state", async () => {
    const db = environment.authenticatedContext("one").firestore();
    await assertFails(
      setDoc(
        doc(db, "games/game-1"),
        { currentTurnPlayerId: "one" },
        { merge: true },
      ),
    );
    await assertFails(
      setDoc(doc(db, "games/game-1/publicBoards/two"), {
        attackedCells: { "0-0": "HIT" },
      }),
    );
  });

  it("lets a user read only their active-game pointer", async () => {
    await assertSucceeds(
      getDoc(
        doc(
          environment.authenticatedContext("one").firestore(),
          "activeGames/one",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          environment.authenticatedContext("two").firestore(),
          "activeGames/one",
        ),
      ),
    );
  });
});

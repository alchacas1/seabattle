import { setGlobalOptions } from "firebase-functions/v2/options";

setGlobalOptions({ region: "us-central1", maxInstances: 50, concurrency: 40 });

export {
  attack,
  autoPlaceFleet,
  confirmFleet,
  submitFleet,
} from "./game/callables.js";
export {
  createRoom,
  joinRoom,
  leaveRoom,
  syncGame,
} from "./rooms/callables.js";
export { requestRematch } from "./rooms/rematch.js";
export { handleTurnTimeout } from "./timers/tasks.js";
export {
  handleDisconnectCleanup,
  recordPresenceChange,
} from "./presence/handlers.js";
export { useWeapon } from "./weapons/callables.js";

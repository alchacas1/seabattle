import { onCall } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { useWeaponInputSchema } from "@sea-battle/shared-types";
import { asHttpsError } from "../errors.js";

export const useWeapon = onCall(
  { region: "us-central1", cors: true },
  (request) => {
    try {
      if (!request.auth)
        throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
      const input = useWeaponInputSchema.parse(request.data);
      throw new HttpsError("failed-precondition", "WEAPON_NOT_CONFIGURED", {
        weapon: input.weapon,
        reason:
          "Las reglas competitivas de esta arma todavía no están definidas.",
      });
    } catch (error) {
      return asHttpsError(error);
    }
  },
);

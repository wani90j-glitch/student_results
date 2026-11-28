import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { hashPin, normalizePin, verifyPin } from "./pin";

/** Parent codes: 8 digits, shown once to the teacher for printing; only a keyed hash is stored. */
export const parentLookup = (code: string) => createHmac("sha256", process.env.PIN_PEPPER || "").update("parent|" + normalizePin(code)).digest("hex");
export const newParentCode = () => String(randomInt(10000000, 99999999));
export const hashParentCode = (code: string) => hashPin("parent|" + normalizePin(code));
export const verifyParentCode = (code: string, stored: string) => verifyPin("parent|" + normalizePin(code), stored);

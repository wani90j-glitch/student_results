/**
 * Student PIN (the national ID number) handling. Server only.
 * - pin_lookup = HMAC-SHA256(PIN_PEPPER, pin): finds the student without storing the PIN; useless without the pepper.
 * - pin_hash   = scrypt with a per-student salt: the actual check.
 * The PIN itself is never stored or logged.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Keeps digits only (also converts Arabic-Indic digits), so "١١٠٠ ٠٠٠" and "1100000" are the same PIN. */
export function normalizePin(v: string) {
  return String(v || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");
}

function pepper() {
  const p = process.env.PIN_PEPPER;
  if (!p || p.length < 32) throw new Error("PIN_PEPPER is missing or too short");
  return p;
}

export function pinLookup(pin: string) {
  return createHmac("sha256", pepper()).update(normalizePin(pin)).digest("hex");
}

const N = 16384, r = 8, p = 1, LEN = 32;
export function hashPin(pin: string) {
  const salt = randomBytes(16);
  const h = scryptSync(normalizePin(pin), salt, LEN, { N, r, p });
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}

export function verifyPin(pin: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [alg, s, h] = stored.split("$");
  if (alg !== "scrypt" || !s || !h) return false;
  const want = Buffer.from(h, "base64");
  const got = scryptSync(normalizePin(pin), Buffer.from(s, "base64"), want.length, { N, r, p });
  return got.length === want.length && timingSafeEqual(got, want);
}

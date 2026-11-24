import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
export const fail = (code: string, status: number) => json({ error: code }, status);
/** A one-way hash of the caller's IP, only for counting sign-in attempts (the IP itself is not stored). */
export function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  return createHash("sha256").update((process.env.PIN_PEPPER || "") + "|ip|" + ip).digest("hex").slice(0, 32);
}

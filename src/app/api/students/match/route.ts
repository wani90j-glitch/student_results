/** Matches national ID numbers found in an Excel file or on a photographed sheet to the teacher's own students. */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { normalizePin, pinLookup } from "@/lib/server/pin";

export async function POST(req: Request) {
  const c = await caller();
  if (c.role !== "teacher") return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const pins: string[] = [...new Set<string>((Array.isArray(b.pins) ? b.pins : []).map((p: unknown) => normalizePin(String(p))))].filter((p) => p.length >= 8).slice(0, 1000);
  if (!pins.length) return json({ map: {} });
  const byLookup = new Map(pins.map((p) => [pinLookup(p), p]));
  const { data } = await supabaseAdmin().from("students").select("id, pin_lookup").eq("teacher_id", c.teacher.id).in("pin_lookup", [...byLookup.keys()]);
  return json({ map: Object.fromEntries((data || []).map((s: any) => [byLookup.get(s.pin_lookup), s.id])) });
}

/**
 * Parent codes for a teacher's students (or, in a subscribed school, from the principal or the student deputy).
 * Each call makes NEW codes and returns them once, for printing; only a keyed hash is kept.
 * A parent who already signed in keeps access; a code can be withdrawn (revoke).
 */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { hashParentCode, newParentCode, parentLookup } from "@/lib/server/codes";
import { fail, json } from "@/lib/server/http";

export async function POST(req: Request) {
  const c = await caller();
  if (c.role !== "teacher" && !(c.role === "staff" && ["principal", "student_deputy"].includes(c.staff.role))) return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const ids: string[] = (Array.isArray(b.studentIds) ? b.studentIds : []).map(String).slice(0, 600);
  // only students the caller may see (her own, or her school's for staff): read with her session (RLS)
  const { data: rows } = await c.sb.from("students").select("id, pin_lookup").in("id", ids.length ? ids : ["-"]);
  const admin = supabaseAdmin(), codes: Record<string, string> = {}, missing: string[] = [];
  for (const s of rows || []) {
    if (!s.pin_lookup) { missing.push(s.id); continue; }
    for (let tries = 0; tries < 5; tries++) {
      const code = newParentCode();
      const { error } = await admin.from("parent_codes").insert({ code_lookup: parentLookup(code), code_hash: hashParentCode(code), student_pin_lookup: s.pin_lookup, created_by: c.user!.id });
      if (!error) { codes[s.id] = code; break; }
    }
  }
  return json({ codes, missing });
}

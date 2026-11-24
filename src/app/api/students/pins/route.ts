/** The teacher sets students' PINs (national ID numbers). Only a keyed hash is kept; the number is dropped here. */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { hashPin, normalizePin, pinLookup } from "@/lib/server/pin";

export async function POST(req: Request) {
  const c = await caller();
  if (c.role !== "teacher") return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const items: { id: string; nid: string }[] = (Array.isArray(b.items) ? b.items : []).slice(0, 500);
  const ids = items.map((i) => String(i.id));
  // the students must be hers (her own session, RLS)
  const { data: mine } = await c.sb.from("students").select("id").in("id", ids.length ? ids : ["-"]);
  const own = new Set((mine || []).map((s: any) => s.id));
  const admin = supabaseAdmin();
  const dup: string[] = [];
  let n = 0;
  for (const it of items) {
    const pin = normalizePin(it.nid);
    if (!own.has(it.id) || pin.length < 8) continue;
    const { error } = await admin.from("students").update({ pin_lookup: pinLookup(pin), pin_hash: hashPin(pin) }).eq("id", it.id).eq("teacher_id", c.teacher.id);
    if (error) { if (error.code === "23505") dup.push(it.id); continue; }
    // her sign-in identity (no e-mail is ever sent to it)
    const { data: s } = await admin.from("students").select("auth_user_id").eq("id", it.id).single();
    if (!s?.auth_user_id) {
      const { data: u } = await admin.auth.admin.createUser({ email: `${it.id.toLowerCase()}@students.itqan.invalid`, email_confirm: true, app_metadata: { role: "student" } });
      if (u?.user) await admin.from("students").update({ auth_user_id: u.user.id }).eq("id", it.id);
    }
    n++;
  }
  return json({ saved: n, duplicates: dup });
}

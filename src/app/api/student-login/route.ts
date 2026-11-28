/**
 * Sign-in with a code, for students and parents:
 *  - a student's national ID number (her one sign-in for all her teachers);
 *  - a parent's 8-digit code (one parent account can follow several daughters).
 * Failed attempts are counted per (hashed) IP; nothing identifying is stored.
 */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { parentLookup, verifyParentCode } from "@/lib/server/codes";
import { fail, ipHash, json } from "@/lib/server/http";
import { normalizePin, pinLookup, verifyPin } from "@/lib/server/pin";
import { createCodeUser, signInAs } from "@/lib/server/session";

const WINDOW_MIN = 15, MAX_FAILS = 8;

export async function POST(req: Request) {
  const admin = supabaseAdmin();
  const ip = ipHash(req);
  const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
  const { count } = await admin.from("login_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ip).eq("ok", false).gte("at", since);
  if ((count ?? 0) >= MAX_FAILS) return fail("rate", 429);
  const body = await req.json().catch(() => ({}));
  const code = normalizePin(String(body.pin || ""));
  const bad = async () => { await admin.from("login_attempts").insert({ ip_hash: ip, ok: false }); return fail("bad", 401); };
  if (code.length < 6 || code.length > 20) return bad();
  try {
    // 1) a student's ID number
    const { data: idt } = await admin.from("student_identities").select("pin_lookup, pin_hash, auth_user_id").eq("pin_lookup", pinLookup(code)).maybeSingle();
    if (idt && verifyPin(code, idt.pin_hash)) {
      let uid = idt.auth_user_id as string | null;
      if (!uid) { uid = await createCodeUser(admin, "student"); await admin.from("student_identities").update({ auth_user_id: uid }).eq("pin_lookup", idt.pin_lookup); }
      await signInAs(admin, uid);
      await admin.from("login_attempts").insert({ ip_hash: ip, ok: true });
      return json({ role: "student" });
    }
    // 2) a parent code
    const { data: pc } = await admin.from("parent_codes").select("code_lookup, code_hash, guardian_id, revoked").eq("code_lookup", parentLookup(code)).maybeSingle();
    if (pc && !pc.revoked && verifyParentCode(code, pc.code_hash)) {
      let gid = pc.guardian_id as string | null, uid: string | null = null;
      if (gid) { const { data: g } = await admin.from("guardians").select("auth_user_id").eq("id", gid).single(); uid = g?.auth_user_id || null; }
      if (!gid || !uid) {
        uid = await createCodeUser(admin, "guardian");
        if (gid) await admin.from("guardians").update({ auth_user_id: uid }).eq("id", gid);
        else { const { data: g } = await admin.from("guardians").insert({ auth_user_id: uid }).select("id").single(); gid = g!.id; await admin.from("parent_codes").update({ guardian_id: gid }).eq("code_lookup", pc.code_lookup); }
      }
      await signInAs(admin, uid!);
      await admin.from("login_attempts").insert({ ip_hash: ip, ok: true });
      return json({ role: "guardian" });
    }
  } catch {
    return fail("server", 500);
  }
  return bad();
}

/** Who is signed in (used when the page opens). */
export async function GET() {
  const c = await caller();
  return json({ role: c.role, sid: c.sid, staff: c.staff ? { role: c.staff.role } : null });
}

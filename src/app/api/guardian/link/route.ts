/** A signed-in parent adds another daughter with the parent code printed for her. */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { parentLookup, verifyParentCode } from "@/lib/server/codes";
import { fail, json } from "@/lib/server/http";
import { normalizePin } from "@/lib/server/pin";

export async function POST(req: Request) {
  const c = await caller();
  if (c.role !== "guardian" || !c.user) return fail("auth", 401);
  const code = normalizePin(String((await req.json().catch(() => ({}))).code || ""));
  const admin = supabaseAdmin();
  const { data: g } = await admin.from("guardians").select("id").eq("auth_user_id", c.user.id).single();
  const { data: pc } = await admin.from("parent_codes").select("code_lookup, code_hash, guardian_id, revoked").eq("code_lookup", parentLookup(code)).maybeSingle();
  if (!g || !pc || pc.revoked || !verifyParentCode(code, pc.code_hash)) return fail("bad", 400);
  if (pc.guardian_id && pc.guardian_id !== g.id) return fail("taken", 409); // already used by another parent account
  await admin.from("parent_codes").update({ guardian_id: g.id }).eq("code_lookup", pc.code_lookup);
  return json({ ok: true });
}

/** Student / parent sign-in with the PIN (the national ID number). */
import { caller, supabaseAdmin, supabaseUser } from "@/lib/supabase/server";
import { fail, ipHash, json } from "@/lib/server/http";
import { normalizePin, pinLookup, verifyPin } from "@/lib/server/pin";

const WINDOW_MIN = 15, MAX_FAILS = 8;

export async function POST(req: Request) {
  const admin = supabaseAdmin();
  const ip = ipHash(req);
  const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
  const { count } = await admin.from("login_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ip).eq("ok", false).gte("at", since);
  if ((count ?? 0) >= MAX_FAILS) return fail("rate", 429);

  const body = await req.json().catch(() => ({}));
  const pin = normalizePin(String(body.pin || ""));
  const bad = async () => { await admin.from("login_attempts").insert({ ip_hash: ip, ok: false }); return fail("bad", 401); };
  if (pin.length < 4 || pin.length > 20) return bad();

  const { data: st } = await admin.from("students").select("id, pin_hash, auth_user_id").eq("pin_lookup", pinLookup(pin)).maybeSingle();
  if (!st || !verifyPin(pin, st.pin_hash)) return bad();
  if (!st.auth_user_id) { // first sign-in: create her sign-in identity (no e-mail is ever sent to it)
    const { data: nu } = await admin.auth.admin.createUser({ email: `${st.id.toLowerCase()}@students.itqan.invalid`, email_confirm: true, app_metadata: { role: "student" } });
    if (!nu?.user) return fail("server", 500);
    await admin.from("students").update({ auth_user_id: nu.user.id }).eq("id", st.id);
    st.auth_user_id = nu.user.id;
  }

  const { data: u } = await admin.auth.admin.getUserById(st.auth_user_id);
  if (!u?.user?.email) return bad();
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (error || !link?.properties?.hashed_token) return fail("server", 500);
  const sb = await supabaseUser();
  await sb.auth.signOut().catch(() => {}); // a teacher previewing on the same device is signed out first
  const { error: e2 } = await sb.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (e2) return fail("server", 500);
  await admin.from("login_attempts").insert({ ip_hash: ip, ok: true });
  return json({ sid: st.id });
}

/** Who is signed in (used when the page opens). */
export async function GET() {
  const c = await caller();
  return json({ role: c.role, sid: c.sid });
}

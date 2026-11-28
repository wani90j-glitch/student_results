/** Invitations waiting for the signed-in person (GET) and accepting one (POST). Joining moves a teacher's work into that school. */
import { supabaseAdmin, supabaseUser } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { moveTeacherToSchool } from "@/lib/server/schools";

async function me() { const sb = await supabaseUser(); const { data: { user } } = await sb.auth.getUser(); return user && !["student", "guardian"].includes(user.app_metadata?.role) ? user : null; }
export async function GET() {
  const user = await me(); if (!user) return fail("auth", 401);
  const admin = supabaseAdmin();
  const { data } = await admin.from("school_members").select("id, role, status, school_id, schools(name, city, code)").eq("user_id", user.id).in("status", ["invited", "requested", "active"]);
  return json({ memberships: data || [] });
}
export async function POST(req: Request) {
  const user = await me(); if (!user) return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();
  const { data: m } = await admin.from("school_members").select("id, role, status, school_id").eq("id", String(b.memberId)).eq("user_id", user.id).maybeSingle();
  if (!m || m.status !== "invited") return fail("invalid_argument", 400);
  if (b.decline) { await admin.from("school_members").update({ status: "removed" }).eq("id", m.id); return json({ ok: true }); }
  await admin.from("school_members").update({ status: "active" }).eq("id", m.id);
  if (m.role === "teacher") {
    const { data: t } = await admin.from("teachers").select("id").eq("id", user.id).maybeSingle();
    if (!t) await admin.from("teachers").insert({ id: user.id, school_id: m.school_id, display_name: String(b.displayName || user.email || "").slice(0, 80) });
    else await moveTeacherToSchool(admin, user.id, m.school_id);
  } else if (b.displayName) await admin.auth.admin.updateUserById(user.id, { user_metadata: { display_name: String(b.displayName).slice(0, 80) } });
  return json({ ok: true });
}

/** The principal approves a request, or removes a member. A teacher who joins brings her work into the school. */
import { supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { moveTeacherToSchool } from "@/lib/server/schools";
import { principal } from "@/lib/server/staffcheck";

export async function POST(req: Request) {
  const p = await principal();
  if (!p) return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();
  const { data: m } = await admin.from("school_members").select("id, user_id, role, status, school_id").eq("id", String(b.memberId)).eq("school_id", p.schoolId).maybeSingle();
  if (!m || m.user_id === p.user!.id) return fail("invalid_argument", 400);
  if (b.action === "approve" && m.status === "requested") {
    await admin.from("school_members").update({ status: "active" }).eq("id", m.id);
    if (m.role === "teacher") await moveTeacherToSchool(admin, m.user_id, p.schoolId);
  } else if (b.action === "remove") {
    await admin.from("school_members").update({ status: "removed" }).eq("id", m.id); // a removed teacher keeps her own work
  } else return fail("invalid_argument", 400);
  return json({ ok: true });
}

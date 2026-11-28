/** The principal invites a staff member or a teacher by e-mail. The person sets her password from the e-mail link. */
import { supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { principal } from "@/lib/server/staffcheck";

const ROLES = ["teacher", "academic_deputy", "student_deputy", "counselor", "principal"];
export async function POST(req: Request) {
  const p = await principal();
  if (!p) return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase(), role = ROLES.includes(b.role) ? b.role : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !role) return fail("invalid_argument", 400);
  const admin = supabaseAdmin();
  // an existing account is linked at once (she accepts from her page); a new one gets an invitation e-mail
  let userId: string | null = null;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const u = data?.users.find((x) => x.email?.toLowerCase() === email); if (u) userId = u.id;
    if (!data || data.users.length < 1000) break;
  }
  if (!userId) {
    const origin = new URL(req.url).origin;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/reset?next=/join` });
    if (error || !data?.user) return fail("invite", 502);
    userId = data.user.id;
  }
  const { error } = await admin.from("school_members").upsert({ school_id: p.schoolId, user_id: userId, email, role, status: "invited", invited_by: p.user!.id }, { onConflict: "school_id,user_id,role" });
  if (error) return fail("server", 500);
  return json({ ok: true });
}

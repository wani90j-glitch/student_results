/** The principal's list of her school's members, invitations and requests. */
import { supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { principal } from "@/lib/server/staffcheck";

export async function GET() {
  const p = await principal();
  if (!p) return fail("auth", 401);
  const admin = supabaseAdmin();
  const { data: rows } = await admin.from("school_members").select("id, user_id, email, role, status, created_at").eq("school_id", p.schoolId).neq("status", "removed").order("created_at");
  const ids = (rows || []).map((r) => r.user_id).filter(Boolean);
  const { data: tch } = await admin.from("teachers").select("id, display_name, subject").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const names: Record<string, { name: string; subject?: string }> = {};
  (tch || []).forEach((t) => (names[t.id] = { name: t.display_name, subject: t.subject }));
  for (const r of rows || []) if (r.user_id && !names[r.user_id]) { const { data: u } = await admin.auth.admin.getUserById(r.user_id); names[r.user_id] = { name: (u?.user?.user_metadata as any)?.display_name || u?.user?.email || "" }; }
  const { data: school } = await admin.from("schools").select("name, code, plan").eq("id", p.schoolId).single();
  return json({ school, members: (rows || []).map((r) => ({ ...r, name: r.user_id ? names[r.user_id]?.name : "", subject: r.user_id ? names[r.user_id]?.subject : "" })) });
}

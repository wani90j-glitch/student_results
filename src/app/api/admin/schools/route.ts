/** Your owner panel: new schools to review, turning the school plan on or off, and merging a duplicate into the right school. */
import { supabaseAdmin, supabaseUser } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { isOwner, moveTeacherToSchool } from "@/lib/server/schools";

async function owner() { const sb = await supabaseUser(); const { data: { user } } = await sb.auth.getUser(); return user && isOwner(user.email) ? user : null; }
export async function GET() {
  if (!(await owner())) return fail("auth", 401);
  const admin = supabaseAdmin();
  const { data: schools } = await admin.from("schools").select("id, name, city, edu_dept, stage, gender, ministry_no, code, plan, reviewed, created_at, merged_into").order("created_at", { ascending: false }).limit(500);
  const { data: t } = await admin.from("teachers").select("school_id");
  const { data: m } = await admin.from("school_members").select("school_id, status").eq("status", "active");
  const count = (rows: any[] | null, id: string) => (rows || []).filter((r) => r.school_id === id).length;
  return json({ schools: (schools || []).map((s) => ({ ...s, teachers: count(t, s.id), members: count(m, s.id) })) });
}
export async function POST(req: Request) {
  if (!(await owner())) return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const admin = supabaseAdmin(), id = String(b.schoolId || "");
  if (b.action === "review") await admin.from("schools").update({ reviewed: true }).eq("id", id);
  else if (b.action === "plan") await admin.from("schools").update({ plan: b.plan === "school" ? "school" : "none" }).eq("id", id);
  else if (b.action === "merge") {
    const into = String(b.into || "");
    if (!into || into === id) return fail("invalid_argument", 400);
    const { data: ts } = await admin.from("teachers").select("id").eq("school_id", id);
    for (const t of ts || []) await moveTeacherToSchool(admin, t.id, into);
    await admin.from("school_members").update({ school_id: into }).eq("school_id", id);
    await admin.from("schools").update({ merged_into: into, reviewed: true }).eq("id", id);
  } else return fail("invalid_argument", 400);
  return json({ ok: true });
}

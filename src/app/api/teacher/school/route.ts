/** An individual teacher corrects her school (her work moves with her). A teacher who joined a school asks her principal instead. */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { moveTeacherToSchool } from "@/lib/server/schools";

export async function POST(req: Request) {
  const c = await caller();
  if (c.role !== "teacher") return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();
  const { count } = await admin.from("school_members").select("id", { count: "exact", head: true }).eq("user_id", c.user!.id).eq("role", "teacher").eq("status", "active");
  if (count) return fail("joined", 409);
  const { data: s } = await admin.from("schools").select("id").eq("id", String(b.schoolId)).is("merged_into", null).maybeSingle();
  if (!s) return fail("invalid_argument", 400);
  await moveTeacherToSchool(admin, c.user!.id, s.id);
  return json({ ok: true });
}

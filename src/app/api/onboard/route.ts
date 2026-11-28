/**
 * First step after an e-mail sign-up: choose the school (or add it) and the role.
 *  - teacher: works on her own at once (individual plan); in a subscribed school she can ask to join it.
 *  - principal: becomes the school's principal if it has none yet; otherwise her request waits for that principal.
 *  - deputies / counselor: join by invitation from the principal (or a request the principal approves).
 */
import { randomUUID } from "node:crypto";
import { supabaseAdmin, supabaseUser } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { schoolCode } from "@/lib/server/schools";

const STAGES = ["primary", "intermediate", "secondary", "other"], GENDERS = ["girls", "boys", "mixed"], ROLES = ["teacher", "principal", "academic_deputy", "student_deputy", "counselor"];
const clean = (v: unknown, n = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export async function POST(req: Request) {
  const sb = await supabaseUser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || ["student", "guardian"].includes(user.app_metadata?.role)) return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const role = ROLES.includes(b.role) ? b.role : "teacher";
  const displayName = clean(b.displayName, 80);
  if (!displayName) return fail("name", 400);
  const admin = supabaseAdmin();

  // the school: chosen from the directory, or added (one record per ministry number)
  let schoolId: string | null = null;
  if (b.schoolId) { const { data } = await admin.from("schools").select("id").eq("id", String(b.schoolId)).is("merged_into", null).maybeSingle(); schoolId = data?.id || null; }
  else if (b.newSchool) {
    const n = b.newSchool, ministry = clean(n.ministryNo, 20).replace(/\D/g, "") || null, name = clean(n.name);
    if (!name) return fail("school_name", 400);
    if (ministry) { const { data } = await admin.from("schools").select("id").eq("ministry_no", ministry).maybeSingle(); if (data) schoolId = data.id; }
    if (!schoolId) {
      const id = randomUUID();
      const { error } = await admin.from("schools").insert({
        id, name, region: clean(n.eduDept) || null, edu_dept: clean(n.eduDept) || null, city: clean(n.city, 60) || null, ministry_no: ministry,
        stage: STAGES.includes(n.stage) ? n.stage : null, gender: GENDERS.includes(n.gender) ? n.gender : null, code: schoolCode(ministry, id), created_by: user.id,
      });
      if (error) return fail("school", 409);
      schoolId = id;
    }
  }
  if (!schoolId) return fail("school", 400);
  const { data: school } = await admin.from("schools").select("id, plan, code").eq("id", schoolId).single();

  let status = "active";
  if (role === "teacher") {
    const { data: t } = await admin.from("teachers").select("id").eq("id", user.id).maybeSingle();
    if (!t) await admin.from("teachers").insert({ id: user.id, school_id: schoolId, display_name: displayName, subject: clean(b.subject, 40) || null, grade: clean(b.grade, 40) || null });
    if (school!.plan === "school" && b.askToJoin) {
      await admin.from("school_members").upsert({ school_id: schoolId, user_id: user.id, role: "teacher", status: "requested" }, { onConflict: "school_id,user_id,role", ignoreDuplicates: true });
      status = "requested";
    } else status = "individual";
  } else {
    const { count } = await admin.from("school_members").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("role", "principal").eq("status", "active");
    status = role === "principal" && !count ? "active" : "requested";
    await admin.from("school_members").upsert({ school_id: schoolId, user_id: user.id, role, status }, { onConflict: "school_id,user_id,role", ignoreDuplicates: true });
    await admin.auth.admin.updateUserById(user.id, { user_metadata: { display_name: displayName } });
  }
  return json({ school: school!.code, status });
}

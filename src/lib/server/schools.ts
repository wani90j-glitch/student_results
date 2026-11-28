import "server-only";

/** Tables whose rows belong to one teacher (teacher_id) and carry the school. */
const TEACHER_TABLES = ["classes", "students", "skills", "questions", "qimg", "tests", "test_results", "improvement_rounds", "improvement_items", "sheets", "sends", "perf_tasks", "behavior_events", "class_groups"];
/** Moves a teacher and all her work to another school (on joining a school, or fixing a wrong choice). */
export async function moveTeacherToSchool(admin: any, teacherId: string, schoolId: string) {
  await admin.from("teachers").update({ school_id: schoolId }).eq("id", teacherId);
  for (const t of TEACHER_TABLES) {
    const { error } = await admin.from(t).update({ school_id: schoolId }).eq("teacher_id", teacherId);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
  const { data: st } = await admin.from("students").select("id").eq("teacher_id", teacherId);
  const ids = (st || []).map((s: any) => s.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    for (const t of ["acks", "notes", "task_submissions"]) await admin.from(t).update({ school_id: schoolId }).in("student_id", chunk);
  }
}

/** A short, readable link for a school page: from the ministry number, else from the name. */
export function schoolCode(ministryNo: string | null | undefined, fallback: string) {
  const n = String(ministryNo || "").replace(/\D/g, "");
  return n ? "m" + n : "s" + fallback.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8);
}

/** The platform owner (you): may review schools, set plans, merge duplicates. */
export const isOwner = (email?: string | null) => !!email && !!process.env.ITQAN_ADMIN_EMAIL && email.toLowerCase() === process.env.ITQAN_ADMIN_EMAIL.trim().toLowerCase();

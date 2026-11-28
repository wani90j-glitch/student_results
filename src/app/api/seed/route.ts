/**
 * A new teacher may start from the platform's ready science curriculum (skills + question bank + figures),
 * copied from the platform owner's own bank with new ids. Only once, and only into an empty bank.
 */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { allRows } from "@/lib/server/rows";

export async function POST() {
  const c = await caller();
  if (c.role !== "teacher") return fail("auth", 401);
  const admin = supabaseAdmin(), me = c.teacher;
  const { count } = await admin.from("skills").select("id", { count: "exact", head: true }).eq("teacher_id", me.id);
  if (count) return fail("not_empty", 409);
  const ownerMail = (process.env.ITQAN_ADMIN_EMAIL || "").trim().toLowerCase();
  let ownerId: string | null = null;
  for (let page = 1; page < 50 && !ownerId; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    ownerId = data?.users.find((u) => u.email?.toLowerCase() === ownerMail)?.id || null;
    if (!data || data.users.length < 1000) break;
  }
  if (!ownerId || ownerId === me.id) return fail("no_source", 404);
  const p = me.id.slice(0, 6) + "_", own = { school_id: me.school_id, teacher_id: me.id };
  const [skills, questions, qimg] = await Promise.all([allRows(admin, "skills", { teacher_id: ownerId }), allRows(admin, "questions", { teacher_id: ownerId }), allRows(admin, "qimg", { teacher_id: ownerId })]);
  await admin.from("subjects").upsert([...new Set(skills.map((s: any) => s.subject_id).filter(Boolean))].map((id) => ({ id, school_id: me.school_id, name: "العلوم", grade: "الثالث المتوسط" })), { onConflict: "school_id,id", ignoreDuplicates: true });
  const ins = async (t: string, rows: any[]) => { for (let i = 0; i < rows.length; i += 400) { const { error } = await admin.from(t).insert(rows.slice(i, i + 400)); if (error) throw new Error(t); } };
  await ins("skills", skills.map((s: any) => ({ ...s, ...own, id: p + s.id })));
  await ins("questions", questions.map((q: any) => ({ ...q, ...own, id: p + q.id, skill_id: q.skill_id ? p + q.skill_id : null })));
  await ins("qimg", qimg.map((q: any) => ({ ...q, ...own, id: p + q.id })));
  return json({ skills: skills.length, questions: questions.length });
}

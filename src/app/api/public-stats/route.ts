/** Landing-page figures: aggregate only (no names), shown when at least 10 students were tested. */
import { impactSummary } from "@/lib/calc/summary";
import { rowsToState } from "@/lib/data/mapping";
import { supabaseAdmin } from "@/lib/supabase/server";
import { json } from "@/lib/server/http";
import { allRows } from "@/lib/server/rows";

export const revalidate = 600;

export async function GET() {
  try {
    const admin = supabaseAdmin();
    const sid = process.env.ITQAN_PUBLIC_SCHOOL_ID;
    const { data: school } = sid ? await admin.from("schools").select("id, name").eq("id", sid).maybeSingle() : await admin.from("schools").select("id, name").order("created_at").limit(1).maybeSingle();
    if (!school) return json({});
    const f = { school_id: school.id };
    const [classes, students, tests, test_results, improvement_rounds, improvement_items] = await Promise.all([
      allRows(admin, "classes", f), allRows(admin, "students", f, "id, class_id, seat_no, name, sort"), allRows(admin, "tests", f),
      allRows(admin, "test_results", f), allRows(admin, "improvement_rounds", f), allRows(admin, "improvement_items", f),
    ]);
    const st = rowsToState({ classes, students, skills: [], tests, test_results, improvement_rounds, improvement_items });
    const main = Object.values(st.tests).sort((a: any, b: any) => Object.keys(b.results).length - Object.keys(a.results).length)[0] as any;
    const settings = { school: school.name };
    if (!main || Object.keys(main.results).length < 10) return json({ settings });
    const s = impactSummary({ skills: [], roster: st.roster, imps: Object.values(st.imps) as any[] }, main);
    return json({ settings, ...s });
  } catch {
    return json({});
  }
}

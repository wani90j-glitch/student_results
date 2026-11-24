/**
 * Everything the student (and her parent) may see, built on the server.
 * Her own rows only; class and school averages arrive as finished numbers (gapPre), and answer keys are removed.
 */
import { groupStats } from "@/lib/calc/core";
import { gapCfgOf, gapTarget } from "@/lib/calc/gap";
import { rowsToState } from "@/lib/data/mapping";
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { allRows } from "@/lib/server/rows";

const strip = (q: any) => { if (!q) return q; const { ans, key, ...rest } = q; return rest; };

export async function GET() {
  const c = await caller();
  if (c.role !== "student" || !c.sid) return fail("auth", 401);
  const admin = supabaseAdmin();
  const me = c.sid, tid = (c as any).student.teacher_id as string, school = (c as any).student.school_id as string;
  const [school_row, teacher, classes, students, skills, tests, test_results, rounds, items] = await Promise.all([
    admin.from("schools").select("*").eq("id", school).single().then((r) => r.data),
    admin.from("teachers").select("*").eq("id", tid).single().then((r) => r.data),
    allRows(admin, "classes", { teacher_id: tid }),
    allRows(admin, "students", { teacher_id: tid }, "id, class_id, seat_no, name, stars, sort"),
    allRows(admin, "skills", { school_id: school }),
    allRows(admin, "tests", { teacher_id: tid }),
    allRows(admin, "test_results", { teacher_id: tid }),
    allRows(admin, "improvement_rounds", { teacher_id: tid }),
    allRows(admin, "improvement_items", { teacher_id: tid }),
  ]);
  const own = { student_id: me };
  const [acks, notes, sends, perf_tasks, task_submissions, sheets, behavior_events] = await Promise.all([
    allRows(admin, "acks", own), allRows(admin, "notes", own), allRows(admin, "sends", own), allRows(admin, "perf_tasks", own),
    allRows(admin, "task_submissions", own), allRows(admin, "sheets", own), allRows(admin, "behavior_events", { ...own }),
  ]);
  const full = rowsToState({ school: school_row, teacher, classes, students, skills, tests, test_results, improvement_rounds: rounds, improvement_items: items });
  const ctx = { skills: full.skills, roster: full.roster, imps: Object.values(full.imps) as any[] };
  const cfg = gapCfgOf(full.settings.gap);
  const meRow = full.roster.find((s) => s.id === me)!;

  // tests: hers in full (keys removed); the others only as "a test happened" so the early notice works as before
  const outTests: Record<string, any> = {};
  const gapPre: Record<string, any> = {};
  Object.values(full.tests).forEach((t: any) => {
    const n = Object.keys(t.results).length;
    if (!n) return;
    if (!t.results[me]) { outTests[t.id] = { id: t.id, name: t.name, type: t.type, date: t.date, qs: [], results: {}, _n: n }; return; }
    const skillPct = (cls?: string) => Object.fromEntries(groupStats(ctx, t, cls).skills.map((k) => [k.id, k.pct]));
    gapPre[t.id] = { cls: gapTarget(ctx, t, meRow.cls, cfg, "cls"), all: gapTarget(ctx, t, meRow.cls, cfg, "all"), skills: { cls: skillPct(meRow.cls), all: skillPct() } };
    const { answers: _a, ...rest } = t; void _a; // other students' chosen options never leave the server
    outTests[t.id] = { ...rest, qs: t.qs.map(strip), results: { [me]: t.results[me] }, _n: n };
  });
  const outImps: Record<string, any> = {};
  Object.values(full.imps).forEach((m: any) => {
    const it = m.items[me];
    if (!it || !outTests[m.base] || !outTests[m.base].results[me]) return;
    outImps[m.id] = { ...m, qs: m.qs.map((q: any, i: number) => (it.includes(i) ? strip(q) : null)), items: { [me]: it }, results: m.results[me] ? { [me]: m.results[me] } : {} };
  });
  // her sheets, only once sent; her shared behaviour notes
  const mine = rowsToState({
    classes, students: students.filter((s: any) => s.id === me), skills: [], tests, test_results: [], improvement_rounds: rounds, improvement_items: [],
    acks, notes, sends, perf_tasks, task_submissions, sheets: sheets.filter((s: any) => s.sent_at), behavior_events: behavior_events.filter((b: any) => b.shared),
  });
  // images of the questions she can see
  const qids = new Set<string>();
  Object.values(outTests).forEach((t: any) => t.qs.forEach((q: any) => q?.img && qids.add(q.id)));
  Object.values(outImps).forEach((m: any) => m.qs.forEach((q: any) => q?.img && qids.add(q.id)));
  const qimg = Object.fromEntries((await allRows(admin, "qimg", { teacher_id: tid, id: [...qids] })).map((r: any) => [r.id, r.data]));

  const st = full.settings;
  return json({
    settings: { school: st.school, region: st.region, teacher: st.teacher, subject: st.subject, grade: st.grade, term: st.term, year: st.year, logo: st.logo, logo2: st.logo2, pfont: st.pfont, gap: st.gap },
    schoolId: school, subjects: [], skills: full.skills, bank: [], roster: [meRow], tests: outTests, imps: outImps,
    acks: mine.acks[me] ? { [me]: mine.acks[me] } : {}, sheets: mine.sheets, sheetPages: mine.sheetPages, qimg, behavior: [],
    stars: { s: { [me]: meRow ? full.stars.s[me] || 0 : 0 }, g: {} }, gapPre, tasks: mine.tasks,
  });
}

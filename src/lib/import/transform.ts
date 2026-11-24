/**
 * Turns the old app's JSON export (button «تنزيل نسخة البيانات») into database rows.
 * Pure: no network, no database. The national ID is passed to `pin` and then dropped.
 * Deterministic: the same export always gives the same rows and ids, so importing twice changes nothing.
 */
import {
  ackToRows, behaviorToRows, groupsToRows, impToRows, qimgToRows, questionsToRows, rosterToRows, settingsToRows, sheetsToRows,
  skillsToRows, subjectsToRows, testToRows, type Row,
} from "@/lib/data/mapping";

export { uuidv5 } from "@/lib/data/mapping";

export interface ExportFile {
  app?: string;
  settings: Record<string, any>;
  skills: any[];
  bank: any[];
  roster: { id: string; no: number; nid?: string; name: string; cls: string }[];
  tests: Record<string, any>;
  improve?: Record<string, any>;
  acks?: Record<string, any>;
  sheets?: Record<string, Record<string, string>>;
  qimg?: Record<string, string>;
  behavior?: any[] | null;
  stars?: { s?: Record<string, number>; g?: Record<string, Record<string, number>> };
}

export function transform(
  ex: ExportFile,
  o: { schoolId: string; teacherId: string; pin: (nid: string) => { lookup: string; hash: string } | null },
) {
  const own = { school_id: o.schoolId, teacher_id: o.teacherId };
  const warnings: string[] = [];
  const st = ex.settings || {};
  const { school, teacher } = settingsToRows(st, o.schoolId, o.teacherId);
  const subjects = subjectsToRows([...new Set(ex.skills.map((s) => s.subj || "sci9"))].map((id) => ({ id, name: st.subject || "العلوم", grade: st.grade })), o.schoolId);
  const skills = skillsToRows(ex.skills.map((s) => ({ ...s, subj: s.subj || "sci9" })), own);
  const questions = questionsToRows(ex.bank, own);
  const qimg = qimgToRows(ex.qimg || {}, own);

  const { classes, students: base } = rosterToRows(ex.roster, own);
  let noPin = 0;
  const stars = ex.stars?.s || {};
  const students = base.map((s, i) => {
    const nid = ex.roster[i].nid;
    const h = nid ? o.pin(String(nid)) : null;
    if (!h) noPin++;
    return { ...s, stars: +stars[s.id] || 0, pin_lookup: h?.lookup ?? null, pin_hash: h?.hash ?? null };
  });
  if (noPin) warnings.push(`${noPin} students have no PIN in the file`);
  const sids = new Set(students.map((s) => s.id));

  const tests: Row[] = [], test_results: Row[] = [];
  Object.values(ex.tests).forEach((t) => { const r = testToRows(t, own, sids); tests.push(r.test); test_results.push(...r.results); });
  const improvement_rounds: Row[] = [], improvement_items: Row[] = [];
  Object.values(ex.improve || {}).forEach((m) => { const r = impToRows(m, own, sids); improvement_rounds.push(r.round); improvement_items.push(...r.items); });

  const acks: Row[] = [], notes: Row[] = [], sends: Row[] = [], perf_tasks: Row[] = [], task_submissions: Row[] = [];
  const sheetSent: Record<string, string | null> = {}, behSeen: Record<string, string | null> = {};
  Object.entries(ex.acks || {}).forEach(([sid, a]) => {
    if (!sids.has(sid)) return;
    const r = ackToRows(sid, a, own);
    acks.push(...r.acks); notes.push(...r.notes); sends.push(...r.sends); perf_tasks.push(...r.perf_tasks); task_submissions.push(...r.task_submissions);
    Object.entries(r.sheetSent).forEach(([k, v]) => (sheetSent[`${sid}|${k}`] = v));
    Object.assign(behSeen, r.behSeen);
    if (r.task_submissions.length) warnings.push(`task work of ${sid}: only the thumbnails were in the file`);
  });
  const sheets = Object.entries(ex.sheets || {}).flatMap(([key, map]) =>
    sheetsToRows(key, Object.fromEntries(Object.entries(map || {}).filter(([sid]) => sids.has(sid)).map(([sid, v]) => [sid, "legacy:" + v])), own, (sid, k) => sheetSent[`${sid}|${k}`] || null));
  const behavior_events = behaviorToRows((ex.behavior || []).filter((b) => sids.has(b.sid)), own, (id) => behSeen[id] ?? null);
  const class_groups = groupsToRows(st.groups || null, ex.stars?.g || {}, own, classes.map((c) => c.name));

  return {
    rows: {
      schools: [school], teachers: [teacher], subjects, classes, students, skills, questions, qimg, tests, test_results,
      improvement_rounds, improvement_items, sheets, sends, perf_tasks, task_submissions, acks, notes, behavior_events, class_groups,
    },
    warnings,
  };
}

/** Insert order (parents first) and the conflict key of each table, for idempotent upserts. */
export const TABLE_KEYS: [string, string][] = [
  ["schools", "id"], ["teachers", "id"], ["subjects", "id"], ["classes", "id"], ["students", "id"], ["skills", "id"], ["questions", "id"], ["qimg", "id"],
  ["tests", "id"], ["test_results", "test_id,student_id"], ["improvement_rounds", "id"], ["improvement_items", "round_id,student_id"],
  ["sheets", "student_id,key"], ["sends", "student_id,test_id"], ["perf_tasks", "student_id,test_id"], ["task_submissions", "id"],
  ["acks", "student_id,key"], ["notes", "id"], ["behavior_events", "id"], ["class_groups", "class_id,idx"],
];

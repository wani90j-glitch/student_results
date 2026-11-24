/**
 * Turns the old app's JSON export (button «تنزيل نسخة البيانات») into database rows.
 * Pure: no network, no database. The national ID is passed to `pin` callbacks and then dropped.
 * Deterministic: the same export always gives the same rows and ids, so importing twice changes nothing.
 */
import { createHash } from "node:crypto";

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
}

export interface Upload { bucket: string; path: string; dataUri: string }

/** RFC 4122 v5 uuid (sha1), so derived ids are stable across runs. */
export function uuidv5(name: string, ns = "6ba7b811-9dad-11d1-80b4-00c04fd430c8") {
  const nsb = Buffer.from(ns.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(Buffer.concat([nsb, Buffer.from(name, "utf8")])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const extOf = (dataUri: string) => (/^data:image\/(png|jpe?g|webp|gif)/.exec(dataUri)?.[1] || "bin").replace("jpeg", "jpg");
const iso = (v: unknown) => (typeof v === "string" && v ? v : null);
const QFIELDS = ["opts", "ans", "key", "pairs", "x", "y", "crit", "parts", "ul", "max", "img"];

export function transform(
  ex: ExportFile,
  o: { schoolId: string; teacherId: string; pin: (nid: string) => { lookup: string; hash: string } | null },
) {
  const school_id = o.schoolId, teacher_id = o.teacherId, own = { school_id, teacher_id };
  const st = ex.settings || {};
  const uploads: Upload[] = [];
  const warnings: string[] = [];

  // school header and logos
  const school: Record<string, unknown> = { id: school_id, name: st.school || "", region: st.region || null, logo_path: null, logo2_path: null };
  (["logo", "logo2"] as const).forEach((k) => {
    if (typeof st[k] === "string" && st[k].startsWith("data:")) {
      const path = `${school_id}/${k}.${extOf(st[k])}`;
      uploads.push({ bucket: "logos", path, dataUri: st[k] });
      school[k === "logo" ? "logo_path" : "logo2_path"] = path;
    }
  });
  const teacher = {
    id: teacher_id, school_id, display_name: st.teacher || "", subject: st.subject || null, grade: st.grade || null,
    term: st.term || null, year: st.year || null, pfont: st.pfont || "IBM Plex Sans Arabic",
    settings: { gap: st.gap || null, tt: st.tt || null, groups: st.groups || null, aiLog: st.aiLog || [] },
  };

  const subjIds = [...new Set(ex.skills.map((s) => s.subj || "sci9"))];
  const subjects = subjIds.map((id) => ({ id, school_id, name: st.subject || "العلوم", grade: st.grade || null }));

  // classes and students
  const clsNames = [...new Set(ex.roster.map((s) => s.cls))].sort((a, b) => a.localeCompare(b, "ar"));
  const classId = (name: string) => uuidv5(`class|${teacher_id}|${name}`);
  const classes = clsNames.map((name) => ({ id: classId(name), ...own, name }));
  let noPin = 0;
  const students = ex.roster.map((s, i) => {
    const h = s.nid ? o.pin(String(s.nid)) : null;
    if (!h) noPin++;
    return { id: s.id, ...own, class_id: classId(s.cls), seat_no: +s.no || 0, name: s.name, sort: i, pin_lookup: h?.lookup ?? null, pin_hash: h?.hash ?? null };
  });
  if (noPin) warnings.push(`${noPin} طالبة بلا رقم سري في الملف`);
  const sids = new Set(students.map((s) => s.id));

  const skills = ex.skills.map((s, i) => ({
    id: s.id, ...own, subject_id: s.subj || "sci9", chapter: s.ch, chapter_no: s.chNo ?? null, lesson: s.lesson || null, level: s.level, name: s.name, sort: i,
  }));

  const qimg = ex.qimg || {};
  const questions = ex.bank.map((q, i) => {
    const body: Record<string, unknown> = {};
    QFIELDS.forEach((k) => { if (q[k] != null) body[k] = q[k]; });
    let image_path: string | null = null;
    if (qimg[q.id]) {
      image_path = `${school_id}/${q.id}.${extOf(qimg[q.id])}`;
      uploads.push({ bucket: "qimg", path: image_path, dataUri: qimg[q.id] });
    }
    return { id: q.id, ...own, skill_id: q.skill || null, type: q.type, text: q.text || "", body, image_path, src: q.src || null, adapted: !!q.adapted, v: q.v ?? null, sort: i };
  });
  // images of questions that only live inside tests (snapshots) are kept too
  const bankIds = new Set(ex.bank.map((q) => q.id));
  Object.entries(qimg).forEach(([id, uri]) => {
    if (!bankIds.has(id)) uploads.push({ bucket: "qimg", path: `${school_id}/${id}.${extOf(uri)}`, dataUri: uri });
  });

  const tests = Object.values(ex.tests).map((t: any) => ({
    id: t.id, ...own, name: t.name, type: t.type, date: t.date, dur: t.dur == null ? null : String(t.dur), qs: t.qs, demo: !!t.demo,
  }));
  const test_results = Object.values(ex.tests).flatMap((t: any) =>
    Object.entries(t.results || {}).filter(([sid]) => sids.has(sid)).map(([sid, marks]) => ({ test_id: t.id, student_id: sid, ...own, marks: (marks as number[]).map((v) => +v || 0) })),
  );

  const imps = Object.values(ex.improve || {});
  const improvement_rounds = imps.map((m: any) => ({ id: m.id, test_id: m.base, ...own, crit: m.crit, date: m.date, round: m.round ?? null, qs: m.qs }));
  const improvement_items = imps.flatMap((m: any) =>
    Object.entries(m.items || {}).filter(([sid]) => sids.has(sid)).map(([sid, items]) => ({
      round_id: m.id, student_id: sid, ...own, items, results: (m.results || {})[sid] ?? null,
    })),
  );

  // per-student records kept in "acks" by the old app
  const acks: any[] = [], notes: any[] = [], sends: any[] = [], perf_tasks: any[] = [], task_submissions: any[] = [];
  const sheetSent: Record<string, string> = {}; // `${sid}|${key}` -> sent at
  const behSeen: Record<string, string | null> = {};
  Object.entries(ex.acks || {}).forEach(([sid, a]: [string, any]) => {
    if (!sids.has(sid)) return;
    Object.entries(a.seen || {}).forEach(([key, at]) => iso(at) && acks.push({ student_id: sid, key, school_id, seen_at: at }));
    (a.notes || []).forEach((n: any, i: number) => notes.push({ id: uuidv5(`note|${sid}|${i}|${n.at}`), student_id: sid, school_id, test_id: n.test || null, by: n.by === "t" ? "t" : "p", text: String(n.text || ""), at: n.at || new Date(0).toISOString() }));
    Object.entries(a.sheet || {}).forEach(([tid, v]: [string, any]) => { if (v && v.at) sheetSent[`${sid}|${tid}`] = v.at; });
    (a.beh || []).forEach((b: any) => (behSeen[b.id] = iso(b.seen)));
    Object.entries(a.sent || {}).forEach(([tid, v]: [string, any]) => {
      const imps2 = Object.assign({}, v.imp && v.imp.id ? { [v.imp.id]: v.imp.at } : {}, v.imps || {});
      Object.entries(v.impg || {}).forEach(([mid, at]) => (sheetSent[`${sid}|${mid}_g`] = at as string));
      sends.push({ student_id: sid, test_id: tid, ...own, paper_at: iso(v.paper), imps: imps2, plan: v.plan || null });
      if (v.task) {
        const k = v.task, id = uuidv5(`task|${sid}|${tid}`);
        perf_tasks.push({
          id, student_id: sid, test_id: tid, ...own, skills: k.skills || [], title: k.title || "", descr: k.desc || "", deliver: k.del || "any", due: k.due || null,
          rubric: k.rubric || [], sent_at: k.at || new Date(0).toISOString(), ai_eval: k.ev || null, teacher_grade: k.tg ?? null, teacher_note: k.tnote || null,
        });
        if (k.sub) {
          const subId = uuidv5(`sub|${sid}|${tid}|${k.sub.at}`);
          const thumbs = (k.sub.th || []).map((uri: string, i: number) => {
            const path = `${school_id}/student/${sid}/${subId}/thumb${i}.${extOf(uri)}`;
            uploads.push({ bucket: "submissions", path, dataUri: uri });
            return path;
          });
          if (k.sub.aid) warnings.push(`ملف مهمة أدائية أصلي غير موجود في الملف (طالبة ${sid}) — تبقى الصور المصغّرة`);
          task_submissions.push({ id: subId, task_id: id, student_id: sid, school_id, kind: k.sub.kind || "img", storage_path: null, thumbs, name: k.sub.name || null, size: k.sub.size ?? null, note: k.sub.note || null, duration: k.sub.dur ?? null, submitted_at: k.sub.at });
        }
      }
    });
  });

  // scanned sheets: the export holds the old asset ids only; files are attached later
  const sheets: any[] = [];
  Object.entries(ex.sheets || {}).forEach(([key, map]) =>
    Object.entries(map || {}).forEach(([sid, asset]) => {
      if (!sids.has(sid)) return;
      sheets.push({ id: uuidv5(`sheet|${sid}|${key}`), ...own, student_id: sid, key, storage_path: null, pages: [], mime: null, legacy_asset: String(asset), sent_at: sheetSent[`${sid}|${key}`] || null });
    }),
  );

  const behavior_events = (ex.behavior || []).filter((b) => sids.has(b.sid)).map((b) => ({
    id: b.id, student_id: b.sid, ...own, kind: b.kind === "pos" ? "pos" : "neg", type: b.type, note: b.note || null, date: b.date, shared: !!b.share, parent_seen_at: behSeen[b.id] ?? null,
  }));

  const class_groups: any[] = [];
  Object.entries(st.groups || {}).forEach(([cls, g]: [string, any]) => {
    if (!g || !g.n || !clsNames.includes(cls)) return;
    for (let i = 0; i < g.n; i++) class_groups.push({ class_id: classId(cls), idx: i, ...own, stars: 0, members: Object.entries(g.of || {}).filter(([, v]) => +(v as number) === i).map(([sid]) => sid) });
  });

  return {
    rows: {
      schools: [school], teachers: [teacher], subjects, classes, students, skills, questions, tests, test_results,
      improvement_rounds, improvement_items, sheets, sends, perf_tasks, task_submissions, acks, notes, behavior_events, class_groups,
    },
    uploads,
    warnings,
  };
}

/** Insert order (parents first) and the conflict key of each table, for idempotent upserts. */
export const TABLE_KEYS: [string, string][] = [
  ["schools", "id"], ["teachers", "id"], ["subjects", "id"], ["classes", "id"], ["students", "id"], ["skills", "id"], ["questions", "id"],
  ["tests", "id"], ["test_results", "test_id,student_id"], ["improvement_rounds", "id"], ["improvement_items", "round_id,student_id"],
  ["sheets", "student_id,key"], ["sends", "student_id,test_id"], ["perf_tasks", "student_id,test_id"], ["task_submissions", "id"],
  ["acks", "student_id,key"], ["notes", "id"], ["behavior_events", "id"], ["class_groups", "class_id,idx"],
];

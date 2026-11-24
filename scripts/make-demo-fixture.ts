/**
 * Data for the public demo: the teacher's REAL curriculum content (skills, question bank, the two first-period
 * papers, question figures, school header and logos, all shipped inside itqan-source.html) with MADE-UP students
 * and marks. No real student name, ID number or result is used.
 */
import fs from "node:fs";
import { rowsToState } from "../src/lib/data/mapping";
import { transform } from "../src/lib/import/transform";
import { loadLegacy } from "../tests/parity/legacy";

const L = loadLegacy(), D = L.DATA, rnd = L.fn.seededRand(1448);
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const skills = clone(D.skills), bank = clone(D.bank), lvl = (id: string) => (skills.find((s: any) => s.id === id) || {}).level || "K";
const roster: any[] = [];
for (let c = 1; c <= 4; c++) for (let i = 1; i <= 29; i++) roster.push({ id: `d${c}${String(i).padStart(2, "0")}`, no: roster.length + 1, name: `طالبة ${c}-${String(i).padStart(2, "0")}`, cls: `3/${c}` });

// the first-period test as printed (Form A), marks drawn so the school mean is close to the real one (about 79%)
const t: any = { id: "t_p1_1448", name: "اختبار الفترة الأولى", type: "p1", date: "2026-10-18", dur: 45, qs: D.formA.map(L.fn.snap), results: {}, answers: {} };
const base: Record<string, number> = { K: 0.9, A: 0.8, R: 0.64 }, L4 = ["أ", "ب", "ج", "د"];
roster.forEach((s, k) => {
  if (k % 37 === 11) return; // a few absentees
  const ab = (rnd() - 0.5) * 0.45 + (s.cls === "3/2" ? 0.04 : s.cls === "3/4" ? -0.04 : 0);
  t.results[s.id] = t.qs.map((q: any) => (rnd() < Math.min(0.98, Math.max(0.1, base[lvl(q.skill)] + ab)) ? 1 : 0));
  t.answers[s.id] = t.qs.map((q: any, i: number) => {
    const ok = t.results[s.id][i];
    if (q.type === "tf") return (ok ? q.ans || 0 : 1 - (q.ans || 0)) === 0 ? "صح" : "خطأ";
    const wrong = [0, 1, 2, 3].filter((x) => x !== (q.ans || 0));
    return L4[ok ? q.ans || 0 : wrong[Math.floor(rnd() * rnd() * 3)]]; // some distractors attract more than others
  });
});
const w: any = { id: "t_p1_1448_w", name: "اختبار الفترة الأولى – النموذج الكتابي", type: "p1", date: "2026-10-17", dur: 45, qs: D.written.map(L.fn.snap), results: {} };

const settings = { school: "المتوسطة الأولى بالتوبي", region: "الإدارة العامة للتعليم بالمنطقة الشرقية", teacher: "أ/ وفاء الزهراني", subject: "العلوم", grade: "الثالث المتوسط", term: "الفصل الدراسي الأول", year: "1448هـ", logo: D.logos.school, logo2: D.logos.moe, pfont: "IBM Plex Sans Arabic", gap: { mode: "crit", crit: 80 } };
const ex: any = { app: "itqan", settings, skills, bank, roster, tests: { [t.id]: t, [w.id]: w }, improve: {}, acks: {}, sheets: {}, qimg: clone(D.qimg), behavior: [] };

// the improvement test, built by the original code, with made-up results
Object.assign(L.S, { skills, bank, roster, tests: ex.tests, imps: ex.improve, acks: {}, behavior: [], settings: { gap: settings.gap } });
const m = L.fn.buildImprovement(t, "lost");
m.id = "m_p1_1448"; m.date = "2026-11-01";
Object.entries(m.items as Record<string, number[]>).forEach(([sid, it], k) => { if (k % 23 !== 7) m.results[sid] = it.map(() => (rnd() < 0.78 ? 1 : 0)); });
ex.improve[m.id] = m;
// a few parent acknowledgements and notes
roster.forEach((s, k) => { if (t.results[s.id] && k % 5 < 3) ex.acks[s.id] = { id: s.id, seen: { [t.id]: "2026-10-22T10:00:00Z" }, notes: [] }; });

const { rows } = transform(ex, { schoolId: "00000000-0000-0000-0000-000000000d01", teacherId: "00000000-0000-0000-0000-000000000d02", pin: () => ({ lookup: "x", hash: "y" }) });
const r: any = rows;
const st = rowsToState({ ...r, school: r.schools[0], teacher: r.teachers[0] });
st.roster.forEach((s: any) => (s.hasPin = true));
fs.writeFileSync(process.argv[2] || "demo-data.json", JSON.stringify(st));
const g = Object.values(t.results) as number[][];
console.log("students", roster.length, "graded", g.length, "mean %", Math.round((g.reduce((a, x) => a + x.reduce((p, q) => p + q, 0), 0) / g.length / 20) * 1000) / 10, "improvement items", Object.keys(m.items).length);

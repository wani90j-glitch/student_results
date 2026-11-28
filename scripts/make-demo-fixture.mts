/**
 * Data for the demo: the teacher's REAL curriculum content (skills, question bank, the two first-period papers,
 * question figures, school header and logos, all shipped inside itqan-source.html).
 * Students: made up by default. With REAL_GRADES=<json> and DEMO_PASSWORD=<pass> (teacher's request), the real names
 * and real totals (period mark, improvement mark) are used; the names are stored only AES-256-GCM encrypted with a
 * key derived from the password (PBKDF2-SHA256), and the page shows "طالبة c-nn" until the teacher signs in with it.
 * Which questions each student missed is not in the grade sheet, so that spread is simulated to match her real total.
 * No ID number is ever used.
 */
import fs from "node:fs";
import { webcrypto as wc } from "node:crypto";
import { rowsToState } from "../src/lib/data/mapping";
import { transform } from "../src/lib/import/transform";
import { loadLegacy } from "../tests/parity/legacy";

const L = loadLegacy(), D = L.DATA, rnd = L.fn.seededRand(1448);
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const skills = clone(D.skills), bank = clone(D.bank), lvl = (id: string) => (skills.find((s: any) => s.id === id) || {}).level || "K";
const REAL: { cls: number; no: number; name: string; base: number; got: number | null; of: number | null; after: number }[] | null =
  process.env.REAL_GRADES ? JSON.parse(fs.readFileSync(process.env.REAL_GRADES, "utf8")) : null;
const roster: any[] = [];
const realBy: Record<string, (typeof REAL extends (infer U)[] | null ? U : never)> = {};
if (REAL) REAL.slice().sort((a, b) => a.cls - b.cls || a.no - b.no).forEach((r) => { const id = `d${r.cls}${String(r.no).padStart(2, "0")}`; realBy[id] = r as any; roster.push({ id, no: roster.length + 1, name: `طالبة ${r.cls}-${String(r.no).padStart(2, "0")}`, cls: `3/${r.cls}` }); });
else for (let c = 1; c <= 4; c++) for (let i = 1; i <= 29; i++) roster.push({ id: `d${c}${String(i).padStart(2, "0")}`, no: roster.length + 1, name: `طالبة ${c}-${String(i).padStart(2, "0")}`, cls: `3/${c}` });

// the first-period test as printed (Form A), marks drawn so the school mean is close to the real one (about 79%)
const t: any = { id: "t_p1_1448", name: "اختبار الفترة الأولى", type: "p1", date: "2026-10-18", dur: 45, qs: D.formA.map(L.fn.snap), results: {}, answers: {} };
const base: Record<string, number> = { K: 0.9, A: 0.8, R: 0.64 }, L4 = ["أ", "ب", "ج", "د"];
roster.forEach((s, k) => {
  const real = realBy[s.id];
  if (real) { // exactly her real total: the lost marks fall on harder questions more often
    const lost = 20 - real.base, w = t.qs.map((q: any, i: number) => ({ i, key: rnd() * (1 - base[lvl(q.skill)] + 0.08) }));
    const wrong = new Set(w.sort((a: any, b: any) => b.key - a.key).slice(0, lost).map((x: any) => x.i));
    t.results[s.id] = t.qs.map((_: any, i: number) => (wrong.has(i) ? 0 : 1));
  } else {
  if (k % 37 === 11) return; // a few absentees
  const ab = (rnd() - 0.5) * 0.45 + (s.cls === "3/2" ? 0.04 : s.cls === "3/4" ? -0.04 : 0);
  t.results[s.id] = t.qs.map((q: any) => (rnd() < Math.min(0.98, Math.max(0.1, base[lvl(q.skill)] + ab)) ? 1 : 0));
  }
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
Object.entries(m.items as Record<string, number[]>).forEach(([sid, it], k) => {
  const real = realBy[sid];
  if (real) { // her real improvement mark: `got` correct out of her items
    const got = real.got ?? (real.after > real.base ? real.after - real.base : null); // a cell the PDF reader missed: after − period
    if (got == null) return; // did not sit the improvement test
    const ok = new Set(it.map((_, j) => ({ j, r: rnd() })).sort((a, b) => a.r - b.r).slice(0, got).map((x) => x.j));
    m.results[sid] = it.map((_, j) => (ok.has(j) ? 1 : 0));
  } else if (k % 23 !== 7) m.results[sid] = it.map(() => (rnd() < 0.78 ? 1 : 0));
});
ex.improve[m.id] = m;
// a few parent acknowledgements and notes
roster.forEach((s, k) => { if (t.results[s.id] && k % 5 < 3) ex.acks[s.id] = { id: s.id, seen: { [t.id]: "2026-10-22T10:00:00Z" }, notes: [] }; });

const { rows } = transform(ex, { schoolId: "00000000-0000-0000-0000-000000000d01", teacherId: "00000000-0000-0000-0000-000000000d02", pin: () => ({ lookup: "x", hash: "y" }) });
/**
 * Names read from a grade-sheet PDF: the PDF stores the lam-alef ligature and the word Allah as glyphs, so the text can
 * come out with "لا" as "ال" and "الله" as "هللا"; some cells also carry the next column's heading. General rules only
 * (no names are written in this repository); anything else is corrected in the teacher's own data file.
 */
function fixPdfName(n: string) {
  return n
    .replace(/\s*الطالبات:.*$/, "")                 // a heading that leaked into the cell
    .replace(/هللا/g, "الله")                         // the Allah glyph
    .replace(/(^|\s)األ/g, "$1الأ")                   // "األ" at the start of a word is "الأ"
    .replace(/(^|\s)ال(?=\s)/g, "$1آل")               // a lone "ال" before a family name is "آل"
    .replace(/\s+/g, " ").trim();
}
const r: any = rows;
const st = rowsToState({ ...r, school: r.schools[0], teacher: r.teachers[0] });
st.roster.forEach((s: any) => (s.hasPin = true));
if (REAL) { // real names, encrypted; the page decrypts them only with the teacher's password
  const pass = process.env.DEMO_PASSWORD; if (!pass || pass.length < 8) throw new Error("DEMO_PASSWORD (8+ characters) is required with REAL_GRADES");
  const names = Object.fromEntries(Object.entries(realBy).map(([id, r]) => [id, fixPdfName(r.name)]));
  const salt = wc.getRandomValues(new Uint8Array(16)), iv = wc.getRandomValues(new Uint8Array(12));
  const base0 = await wc.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, base0, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = new Uint8Array(await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(names))));
  const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
  (st as any).enc = { alg: "PBKDF2-SHA256-250000/AES-256-GCM", salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  // consistency check against the grade sheet: after-improvement totals must match
  const { studentStats } = await import("../src/lib/calc/core");
  const ctx = { skills: st.skills, roster: st.roster, imps: Object.values(st.imps) as any[] };
  const bad = Object.entries(realBy).filter(([id, r]) => { const x = studentStats(ctx, st.tests.t_p1_1448 as any, id); return !x || x.base !== r.base || x.score !== r.after; });
  console.log("real students", Object.keys(realBy).length, "mismatching totals", bad.length);
}
fs.writeFileSync(process.argv[2] || "demo-data.json", JSON.stringify(st));
const g = Object.values(t.results) as number[][];
console.log("students", roster.length, "graded", g.length, "mean %", Math.round((g.reduce((a, x) => a + x.reduce((p, q) => p + q, 0), 0) / g.length / 20) * 1000) / 10, "improvement items", Object.keys(m.items).length);

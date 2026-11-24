/**
 * A made-up class in the exact shape of the old app's JSON export. Names are placeholders and the
 * "national IDs" are fake numbers; no real data is ever used in tests that run outside the teacher's machine.
 */
import type { ExportFile } from "@/lib/import/transform";
import type { Legacy } from "../parity/legacy";

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

export function syntheticExport(L: Legacy, opt: { rounds?: number } = {}): ExportFile {
  const rnd = L.fn.seededRand(4242);
  const skills = clone(L.DATA.skills), bank = clone(L.DATA.bank);
  const roster: any[] = [];
  for (let c = 1; c <= 3; c++)
    for (let i = 1; i <= 14; i++)
      roster.push({ id: `s${c}${String(i).padStart(2, "0")}x`, no: roster.length + 1, nid: String(9900000000 + c * 100 + i), name: `طالبة ${c}-${i}`, cls: `3/${c}` });
  const pool = bank.filter((q: any) => skills.find((s: any) => s.id === q.skill && s.chNo <= 2));
  const objective = [...pool.filter((q: any) => q.type === "mc").slice(0, 14), ...pool.filter((q: any) => q.type === "tf").slice(0, 4)];
  const other = bank.filter((q: any) => q.type !== "mc" && q.type !== "tf").slice(0, 3);
  const mk = (id: string, date: string, qs: any[], p: number) => {
    const t: any = { id, name: "اختبار " + id, type: "p1", date, dur: 45, qs: qs.map(L.fn.snap), results: {} };
    roster.forEach((s, k) => {
      if (k % 13 === 5) return;
      const ability = (rnd() - 0.45) * 0.6;
      t.results[s.id] = t.qs.map((q: any) => {
        const max = q.type === "mc" || q.type === "tf" ? 1 : q.type === "match" ? (q.pairs || []).length || 1 : +q.max || 1;
        const ok = rnd() < Math.min(0.97, Math.max(0.05, p + ability));
        return max === 1 ? (ok ? 1 : 0) : ok ? max : Math.round(rnd() * max * 2) / 2;
      });
    });
    return t;
  };
  const t1 = mk("t_old", "2026-09-20", objective.slice(0, 12), 0.8);
  const t2 = mk("t_main", "2026-10-18", [...objective, ...other], 0.68);
  const today = new Date().toISOString().slice(0, 10);
  const behavior = roster.slice(0, 6).flatMap((s, k) => Array.from({ length: k % 4 }, (_, j) => ({ id: `b${k}${j}`, sid: s.id, kind: j % 2 ? "pos" : "neg", type: "مشاركة متميزة", note: "", date: today, share: j % 2 === 1 })));
  const ex: ExportFile = {
    app: "itqan",
    settings: { school: "مدرسة تجريبية", region: "إدارة تجريبية", teacher: "معلمة تجريبية", subject: "العلوم", grade: "الثالث المتوسط", term: "الفصل الأول", year: "1448هـ", pfont: "Tajawal", gap: { mode: "cls", crit: 75 }, groups: { "3/1": { n: 2, of: { s101x: 0, s102x: 1 } } }, logo: "data:image/png;base64,iVBORw0KGgo=" },
    skills, bank, roster, tests: { [t1.id]: t1, [t2.id]: t2 }, improve: {}, acks: {}, sheets: { t_main: {} }, qimg: { [bank[0].id]: "data:image/jpeg;base64,/9j/4AAQ" }, behavior,
  };
  roster.forEach((s, k) => {
    const a: any = { id: s.id, seen: {}, notes: [] };
    if (k % 3 === 0) a.seen.t_main = "2026-10-20T10:00:00Z";
    if (k % 5 === 0) a.notes.push({ by: "t", text: "أحسنتِ", at: "2026-10-21T08:00:00Z", test: "t_main" });
    if (k % 4 === 0) a.sent = { t_main: { paper: "2026-10-22T08:00:00Z", plan: { kind: "remedial", text: "خطة", at: "2026-10-22T09:00:00Z" } } };
    if (k === 2) a.sent = { t_main: { task: { skills: ["s001"], title: "مهمة", desc: "وصف", del: "img", due: "", rubric: [{ c: "الدقة", max: 4, lv: [] }], at: "2026-10-23T08:00:00Z", sub: { at: "2026-10-24T08:00:00Z", kind: "img", name: "x.jpg", size: 10, note: "", th: ["data:image/jpeg;base64,/9j/"], aid: "", dur: 0 }, ev: { total: 3 }, tg: 3.5 } } };
    if (k % 2 === 0) { ex.sheets!.t_main[s.id] = "asset" + k; a.sheet = k % 4 === 0 ? { t_main: { a: "asset" + k, at: "2026-10-25T08:00:00Z" } } : undefined; }
    if (k === 0) a.beh = behavior.filter((b) => b.sid === s.id && b.share).map((b) => ({ ...b, seen: "2026-10-26T08:00:00Z" }));
    ex.acks![s.id] = a;
  });
  // improvement rounds built by the ORIGINAL code
  const S = L.S;
  Object.assign(S, { skills, bank, roster, tests: ex.tests, imps: ex.improve, acks: ex.acks, behavior, settings: { gap: { mode: "crit", crit: 80 } } });
  for (let r = 0; r < (opt.rounds ?? 2); r++) {
    const m = L.fn.buildImprovement(ex.tests.t_main, "lost");
    m.id = "m_round" + (r + 1);
    Object.entries(m.items as Record<string, number[]>).forEach(([sid, it], k) => { if (k % (r ? 3 : 7)) m.results[sid] = it.map(() => (rnd() < 0.65 ? 1 : 0)); });
    ex.improve![m.id] = m;
  }
  return ex;
}

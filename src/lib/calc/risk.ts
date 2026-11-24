/** Rule-based early warning. Each signal adds points and a plain reason. Levels: 5+ high, 3–4 medium. */
import { pct, studentStats, testsSorted, type SkillStat } from "./core";
import type { Ctx, Test } from "./types";

export const EW = { low: 50, watch: 65, drop: 10, shareHigh: 0.4, shareMid: 0.25, behDays: 30, behMany: 3, high: 5, mid: 3 };

export interface RiskInput {
  tests: Test[];
  /** student id → keys the parent acknowledged (test id, "ew:<test>") */
  seen: Record<string, Record<string, string | undefined>>;
  behavior: { sid: string; kind: string; date: string }[];
  /** today's date as YYYY-MM-DD (passed in to keep the function pure) */
  now: Date;
}

export const isNeg = (b: { kind: string }) => b.kind !== "pos";

/** `full` adds the signals only the teacher may see (behaviour, parent follow-up). */
export function risk(ctx: Ctx, inp: RiskInput, sid: string, full: boolean) {
  const done = testsSorted(inp.tests).filter((t) => t.results && Object.keys(t.results).length);
  const last = done[0];
  if (!last) return null;
  const x = studentStats(ctx, last, sid), why: string[] = [];
  let pts = 0, weak: SkillStat[] = [];
  const add = (n: number, txt: string) => { pts += n; why.push(txt); };
  if (!x) add(2, `لم تؤدِّ ${last.name}`);
  else {
    const p = pct(x.score, x.total);
    if (p < EW.low) add(3, `إتقانها ${p}% في ${last.name}`);
    else if (p < EW.watch) add(2, `إتقانها ${p}% قريب من حد التعثر`);
    weak = x.skills.filter((o) => o.pct < EW.low);
    const share = x.skills.length ? weak.length / x.skills.length : 0;
    const wtxt = weak.length === 1 ? "مهارة واحدة" : weak.length === 2 ? "مهارتان" : weak.length + (weak.length <= 10 ? " مهارات" : " مهارة");
    if (share >= EW.shareHigh) add(2, `${wtxt} من ${x.skills.length} أقل من ${EW.low}%`);
    else if (share >= EW.shareMid) add(1, `${wtxt} من ${x.skills.length} أقل من ${EW.low}%`);
    const prev = done.slice(1).map((t) => studentStats(ctx, t, sid)).find(Boolean);
    if (prev) {
      const d = pct(prev.score, prev.total) - p;
      if (d >= EW.drop) add(2, `تراجعت ${Math.round(d)} نقطة عن الاختبار السابق`);
    }
    if (full && !(inp.seen[sid] || {})[last.id]) add(1, "وليّ الأمر لم يؤكد الاطلاع على التقرير");
  }
  if (full) {
    const from = new Date(inp.now.getTime() - EW.behDays * 864e5).toISOString().slice(0, 10);
    const n = inp.behavior.filter((b) => b.sid === sid && isNeg(b) && b.date >= from).length;
    if (n >= EW.behMany) add(2, `${n} مخالفات سلوكية خلال ${EW.behDays} يومًا`);
    else if (n === 2) add(1, "مخالفتان سلوكيتان خلال " + EW.behDays + " يومًا");
  }
  return { sid, pts, why, weak, test: last, level: (pts >= EW.high ? "high" : pts >= EW.mid ? "mid" : "ok") as "high" | "mid" | "ok" };
}

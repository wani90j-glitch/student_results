/**
 * Landing-page impact figures, computed live (they were hard-coded in the original page).
 * Effect size is deliberately not reported (teacher's decision); the standard deviation is shown instead.
 */
import { meanSd, pct, roundScores } from "./core";
import type { Ctx, Test } from "./types";

export function impactSummary(ctx: Ctx, t: Test) {
  const R = roundScores(ctx, t);
  const first = R[0], last = R[R.length - 1];
  const max = t.qs.reduce((a, q) => a + (q.type === "mc" || q.type === "tf" ? 1 : q.type === "match" ? (q.pairs || []).length || 1 : +(q.max ?? 0) || 1), 0);
  const before = meanSd(first.scores), after = meanSd(last.scores);
  // students who sat at least one graded improvement round, and how many of them gained marks
  const retested = ctx.roster.filter((s) => t.results[s.id] && ctx.imps.some((m) => m.base === t.id && m.results?.[s.id]));
  const idx = new Map(ctx.roster.filter((s) => t.results[s.id]).map((s, i) => [s.id, i]));
  const improved = retested.filter((s) => last.scores[idx.get(s.id)!] > first.scores[idx.get(s.id)!]).length;
  return {
    n: before.n,
    rounds: R.length - 1,
    meanPctBefore: pct(before.mean, max),
    meanPctAfter: pct(after.mean, max),
    sdBefore: Math.round(before.sd * 100) / 100,
    sdAfter: Math.round(after.sd * 100) / 100,
    retested: retested.length,
    improvedPct: retested.length ? Math.round((improved / retested.length) * 100) : 0,
  };
}

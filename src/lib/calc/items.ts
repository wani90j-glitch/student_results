/**
 * Test quality: classical item analysis (difficulty, discrimination, item–total correlation),
 * reliability (Cronbach's alpha = KR-20 for 0/1 items), standard error of measurement,
 * the test blueprint (content validity against learning outcomes) and trends across tests.
 * Uses the marks as first given (before improvement rounds), as item analysis requires.
 */
import { groupStats, pct, qMax, testsSorted } from "./core";
import type { Ctx, Level, Test } from "./types";

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const variance = (a: number[]) => { const m = mean(a); return a.length ? a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length : 0; };
function corr(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : null;
}
const r2 = (v: number | null) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);

function alphaOf(items: number[][], totals: number[]) {
  const k = items.length, vt = variance(totals);
  if (k < 2 || !vt) return null;
  return (k / (k - 1)) * (1 - items.reduce((s, col) => s + variance(col), 0) / vt);
}

export interface ItemStat {
  i: number; id: string; skill: string; max: number;
  p: number;          // difficulty (facility) index: mean mark / max, 0–1
  d: number | null;   // discrimination: upper 27% minus lower 27%, 0–1 scale
  r: number | null;   // corrected item–total correlation
  alphaIfDeleted: number | null;
  flags: ("easy" | "hard" | "lowDisc" | "negDisc")[];
}

export function itemAnalysis(t: Test, sids: string[]) {
  const ids = sids.filter((id) => t.results?.[id]);
  const maxes = t.qs.map(qMax);
  const cols = t.qs.map((_, i) => ids.map((id) => Math.min(maxes[i], +t.results[id][i] || 0)));
  const totals = ids.map((_, s) => cols.reduce((a, c) => a + c[s], 0));
  const n = ids.length;
  const order = totals.map((v, s) => [v, s]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((x) => x[1]);
  const g = Math.max(1, Math.round(n * 0.27));
  const upper = order.slice(0, g), lower = order.slice(-g);
  const alpha = alphaOf(cols, totals);
  const items: ItemStat[] = t.qs.map((q, i) => {
    const c = cols[i], m = maxes[i];
    const p = n ? mean(c) / m : 0;
    const d = n >= 4 ? (mean(upper.map((s) => c[s])) - mean(lower.map((s) => c[s]))) / m : null;
    const rest = totals.map((v, s) => v - c[s]);
    const r = n >= 4 ? corr(c, rest) : null;
    const others = cols.filter((_, j) => j !== i);
    const aid = alphaOf(others, rest);
    const flags: ItemStat["flags"] = [];
    if (p > 0.9) flags.push("easy");
    if (p < 0.2) flags.push("hard");
    if (d != null && d < 0) flags.push("negDisc");
    else if (d != null && d < 0.2) flags.push("lowDisc");
    return { i, id: q.id, skill: q.skill, max: m, p: Math.round(p * 100) / 100, d: r2(d), r: r2(r), alphaIfDeleted: r2(aid), flags };
  });
  const sd = Math.sqrt(variance(totals));
  return {
    n, k: t.qs.length, total: maxes.reduce((a, b) => a + b, 0),
    mean: Math.round(mean(totals) * 100) / 100, sd: Math.round(sd * 100) / 100,
    alpha: r2(alpha), sem: alpha == null ? null : Math.round(sd * Math.sqrt(Math.max(0, 1 - alpha)) * 100) / 100,
    meanP: Math.round(mean(items.map((x) => x.p)) * 100) / 100,
    meanD: r2(mean(items.filter((x) => x.d != null).map((x) => x.d as number))),
    items,
  };
}

/** Reading of a reliability coefficient for a classroom test. */
export const alphaBand = (a: number | null) => (a == null ? "none" : a >= 0.8 ? "high" : a >= 0.7 ? "mid" : "low");

/** TIMSS grade-8 science cognitive-domain weights (Knowing 35%, Applying 35%, Reasoning 30%). */
export const TIMSS8: Record<Level, number> = { K: 35, A: 35, R: 30 };

/** Test blueprint: marks by cognitive level and by chapter, and how many of the chapters' skills the test covers. */
export function blueprint(ctx: Ctx, t: Test) {
  const sk = (id: string) => ctx.skills.find((s) => s.id === id);
  const total = t.qs.reduce((a, q) => a + qMax(q), 0);
  const lv: Record<Level, number> = { K: 0, A: 0, R: 0 };
  const ch: Record<string, { marks: number; skills: Set<string>; byLv: Record<Level, number> }> = {};
  t.qs.forEach((q) => {
    const k = sk(q.skill), L = (k?.level || "K") as Level, c = k?.ch || "—";
    lv[L] += qMax(q);
    const o = (ch[c] = ch[c] || { marks: 0, skills: new Set(), byLv: { K: 0, A: 0, R: 0 } });
    o.marks += qMax(q); o.skills.add(q.skill); o.byLv[L] += qMax(q);
  });
  const chapters = Object.entries(ch).map(([name, o]) => {
    const all = ctx.skills.filter((s) => s.ch === name).length;
    return { name, marks: o.marks, pct: pct(o.marks, total), byLv: o.byLv, skills: o.skills.size, allSkills: all, coverage: pct(o.skills.size, all) };
  });
  const tested = new Set(t.qs.map((q) => q.skill)).size, inScope = ctx.skills.filter((s) => ch[s.ch]).length;
  return { total, levels: (["K", "A", "R"] as Level[]).map((L) => ({ L, marks: lv[L], pct: pct(lv[L], total) })), chapters, tested, inScope, coverage: pct(tested, inScope) };
}

/** Mean mastery per test in date order (before and after improvement), overall, by level and by class. */
export function trends(ctx: Ctx, tests: Test[], classes: string[]) {
  return testsSorted(tests).reverse().filter((t) => Object.keys(t.results || {}).length).map((t) => {
    const g = groupStats(ctx, t), tot = t.qs.reduce((a, q) => a + qMax(q), 0);
    const lv = Object.fromEntries((["K", "A", "R"] as Level[]).map((L) => [L, g.levels[L].t ? pct(g.levels[L].c0, g.levels[L].t) : null]));
    const cls = Object.fromEntries(classes.map((c) => { const x = groupStats(ctx, t, c); return [c, x.n ? pct(x.mean0, tot) : null]; }));
    return { id: t.id, name: t.name, date: t.date, n: g.n, before: pct(g.mean0, tot), after: pct(g.mean, tot), levels: lv, classes: cls, masteredShare: g.n ? Math.round((g.students.filter((x) => x.score / x.total >= 0.8).length / g.n) * 1000) / 10 : 0 };
  });
}

/* ---------- distractor analysis: which option each student chose (from Excel files and photographed sheets) ---------- */
import { answerIndex } from "./marks";

export interface OptionStat { k: number; n: number; upper: number; lower: number; key: boolean; flag: "" | "unused" | "lure" }
/** Per objective question: how many chose each option, overall and in the upper / lower 27%. Null when no answers were recorded. */
export function distractors(t: Test & { answers?: Record<string, (string | null)[]> }, sids: string[]) {
  const ans = t.answers || {};
  const ids = sids.filter((id) => t.results?.[id]);
  const totals = new Map(ids.map((id) => [id, t.qs.reduce((a, q, i) => a + Math.min(qMax(q), +t.results[id][i] || 0), 0)]));
  const order = ids.slice().sort((a, b) => totals.get(b)! - totals.get(a)! || ids.indexOf(a) - ids.indexOf(b));
  const g = Math.max(1, Math.round(ids.length * 0.27)), up = new Set(order.slice(0, g)), lo = new Set(order.slice(-g));
  return t.qs.map((q, i) => {
    if (q.type !== "mc" && q.type !== "tf") return null;
    const nOpt = q.type === "tf" ? 2 : Math.max(2, (q.opts || []).length || 4);
    const opts: OptionStat[] = Array.from({ length: nOpt }, (_, k) => ({ k, n: 0, upper: 0, lower: 0, key: k === (q.ans || 0), flag: "" as const }));
    let seen = 0, blank = 0;
    ids.forEach((id) => {
      const raw = ans[id]?.[i];
      if (raw == null) return;
      const k = answerIndex(raw, q);
      seen++;
      if (k == null || k >= nOpt) { blank++; return; }
      opts[k].n++; if (up.has(id)) opts[k].upper++; if (lo.has(id)) opts[k].lower++;
    });
    if (!seen) return null;
    opts.forEach((o) => { if (!o.key) o.flag = o.n === 0 ? "unused" : o.upper > o.lower ? "lure" : ""; });
    return { i, seen, blank, opts };
  });
}

/* ---------- quality history of each bank question across every test it appeared in ---------- */
export interface BankStat { uses: number; n: number; p: number; d: number | null; flags: ItemStat["flags"] }
/** Tests with fewer than `minN` students are ignored (too few for stable indices). Weighted by the number of students. */
export function bankStats(tests: Test[], roster: { id: string }[], minN = 10) {
  const acc = new Map<string, { uses: number; n: number; p: number; d: number; dn: number }>();
  const ids = roster.map((s) => s.id);
  tests.forEach((t) => {
    const n = ids.filter((id) => t.results?.[id]).length;
    if (n < minN) return;
    itemAnalysis(t, ids).items.forEach((it) => {
      const a = acc.get(it.id) || { uses: 0, n: 0, p: 0, d: 0, dn: 0 };
      a.uses++; a.n += n; a.p += it.p * n;
      if (it.d != null) { a.d += it.d * n; a.dn += n; }
      acc.set(it.id, a);
    });
  });
  const out: Record<string, BankStat> = {};
  acc.forEach((a, id) => {
    const p = Math.round((a.p / a.n) * 100) / 100, d = a.dn ? Math.round((a.d / a.dn) * 100) / 100 : null;
    const flags: ItemStat["flags"] = [];
    if (p > 0.9) flags.push("easy"); if (p < 0.2) flags.push("hard");
    if (d != null && d < 0) flags.push("negDisc"); else if (d != null && d < 0.2) flags.push("lowDisc");
    out[id] = { uses: a.uses, n: a.n, p, d, flags };
  });
  return out;
}
/** Sort key for building tests: proven good questions first, untested next, flagged last. */
export const qualityRank = (s?: BankStat) => (!s ? 1 : s.flags.length ? 2 : 0);

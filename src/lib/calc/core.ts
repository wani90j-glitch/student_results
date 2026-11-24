/**
 * Core figures of Itqan, ported line by line from the original app (itqan-source.html, "analysis" section).
 * Every function is pure: data comes in through `ctx`, nothing is read from globals.
 */
import type { Ctx, Improvement, Level, Question, Skill, Test } from "./types";

export const LEVELS: Record<Level, string> = { K: "المعرفة", A: "التطبيق", R: "الاستدلال" };
export const BAND = { low: "غير متقنة", mid: "تحتاج دعمًا", high: "متقنة" } as const;
export const PLAN = { low: "خطة علاجية", mid: "دعم إضافي", high: "خطة إثرائية" } as const;
export type Band = keyof typeof BAND;

/** Percentage rounded to one decimal, 0 when the base is 0. */
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const band = (p: number): Band => (p < 50 ? "low" : p < 80 ? "mid" : "high");
export const isAuto = (q: Pick<Question, "type">) => q.type === "mc" || q.type === "tf";
export const qMax = (q: Question) =>
  isAuto(q) ? 1 : q.type === "match" ? (q.pairs || []).length || 1 : +(q.max ?? 0) || 1;
export const sumMarks = (r: number[] | undefined) => (r || []).reduce((a, b) => a + (+b || 0), 0);
export const testMax = (t: Pick<Test, "qs">) => t.qs.reduce((a, q) => a + qMax(q), 0);
export const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** The copy of a bank question that is frozen inside a test. */
export function snap(q: Question): Question {
  const o: Question = { id: q.id, skill: q.skill, type: q.type, text: q.text, opts: q.opts || [], ans: q.ans || 0 };
  (["key", "pairs", "x", "y", "crit", "parts", "ul"] as const).forEach((k) => {
    if (q[k] != null) (o as unknown as Record<string, unknown>)[k] = q[k];
  });
  if (q.img) o.img = 1;
  if (!isAuto(q)) o.max = qMax(q);
  return o;
}

export function seededRand(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export function shuffle<T>(a: T[], rnd: () => number): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export const arSort = (a: string, b: string) => a.localeCompare(b, "ar");
export const skillOf = (ctx: Ctx, id: string): Skill | undefined => ctx.skills.find((s) => s.id === id);
export const classesOf = (ctx: Ctx) => [...new Set(ctx.roster.map((s) => s.cls))].sort(arSort);
export const sortedStudents = (ctx: Ctx, cls?: string) =>
  ctx.roster.filter((s) => !cls || s.cls === cls).sort((a, b) => arSort(a.cls, b.cls) || arSort(a.name, b.name));
export const testsSorted = (tests: Test[]) =>
  tests.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));

/** Improvement rounds built on a test, in order. `only` limits them (used to rebuild the score after each round). */
export function impsOf(ctx: Ctx, testId: string, only?: Set<string> | null): Improvement[] {
  return ctx.imps
    .filter((m) => m.base === testId && (!only || only.has(m.id)))
    .sort(
      (a, b) =>
        (a.round || 0) - (b.round || 0) ||
        (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)),
    );
}

export interface SkillStat { id: string; total: number; correct: number; rec: number; pct0: number; pct: number }
export interface LevelStat { c: number; t: number }
export interface StudentStats {
  sid: string;
  base: number;
  rec: number;
  score: number;
  total: number;
  skills: SkillStat[];
  levels: Partial<Record<Level, LevelStat>>;
  impTotal: number;
  impDone: boolean;
  missing: SkillStat[];
}

/** Per-student figures for one test, including marks recovered in improvement tests. */
export function studentStats(ctx: Ctx, t: Test, sid: string, only?: Set<string> | null): StudentStats | null {
  const r = t.results && t.results[sid];
  if (!r) return null;
  const skills: Record<string, { id: string; total: number; correct: number; rec: number }> = {};
  t.qs.forEach((q, i) => {
    const o = (skills[q.skill] = skills[q.skill] || { id: q.skill, total: 0, correct: 0, rec: 0 });
    o.total += qMax(q);
    o.correct += Math.min(qMax(q), +r[i] || 0);
  });
  let rec = 0, impTotal = 0, impDone = false;
  impsOf(ctx, t.id, only).forEach((m) => {
    const items = m.items && m.items[sid];
    const res = m.results && m.results[sid];
    if (!items) return;
    impTotal += items.length;
    if (!res) return;
    impDone = true;
    items.forEach((qi, k) => {
      const o = skills[m.qs[qi].skill];
      if (o && res[k] && o.correct + o.rec < o.total) {
        const inc = Math.min(1, o.total - o.correct - o.rec);
        o.rec += inc;
        rec += inc;
      }
    });
  });
  const base = t.qs.reduce((a, q, i) => a + Math.min(qMax(q), +r[i] || 0), 0);
  const list: SkillStat[] = Object.values(skills).map((o) => ({ ...o, pct0: pct(o.correct, o.total), pct: pct(o.correct + o.rec, o.total) }));
  const levels: Partial<Record<Level, LevelStat>> = {};
  list.forEach((o) => {
    const L = (skillOf(ctx, o.id)?.level || "K") as Level;
    const v = (levels[L] = levels[L] || { c: 0, t: 0 });
    v.c += o.correct + o.rec;
    v.t += o.total;
  });
  return { sid, base, rec, score: base + rec, total: testMax(t), skills: list, levels, impTotal, impDone, missing: list.filter((o) => o.correct + o.rec < o.total) };
}

export interface GroupSkill { id: string; c: number; t: number; c0: number; low: number; pct: number; pct0: number }
export interface GroupStats {
  n: number;
  students: StudentStats[];
  skills: GroupSkill[];
  levels: Record<Level, { c: number; t: number; c0: number }>;
  mean0: number;
  mean: number;
  full: number;
  low: number;
  need: number;
  full0: number;
  low0: number;
  lost: number;
  rec: number;
}

/** Class/school figures for one test, optionally limited to one class. */
export function groupStats(ctx: Ctx, t: Test, cls?: string): GroupStats {
  const sids = ctx.roster.filter((s) => (!cls || s.cls === cls) && t.results && t.results[s.id]).map((s) => s.id);
  const st = sids.map((id) => studentStats(ctx, t, id) as StudentStats);
  const skills: Record<string, Omit<GroupSkill, "pct" | "pct0">> = {};
  const levels: GroupStats["levels"] = { K: { c: 0, t: 0, c0: 0 }, A: { c: 0, t: 0, c0: 0 }, R: { c: 0, t: 0, c0: 0 } };
  st.forEach((x) => {
    x.skills.forEach((o) => {
      const L0 = (skillOf(ctx, o.id)?.level || "K") as Level;
      if (levels[L0]) levels[L0].c0 += o.correct;
      const g = (skills[o.id] = skills[o.id] || { id: o.id, c: 0, t: 0, c0: 0, low: 0 });
      g.c += o.correct + o.rec;
      g.c0 += o.correct;
      g.t += o.total;
      if (o.pct < 50) g.low++;
    });
    (Object.entries(x.levels) as [Level, LevelStat][]).forEach(([L, v]) => {
      levels[L].c += v.c;
      levels[L].t += v.t;
    });
  });
  const sl = Object.values(skills).map((g) => ({ ...g, pct: pct(g.c, g.t), pct0: pct(g.c0, g.t) })).sort((a, b) => a.pct - b.pct);
  const n = st.length, tot = testMax(t);
  return {
    n, students: st, skills: sl, levels,
    mean0: n ? st.reduce((a, x) => a + x.base, 0) / n : 0,
    mean: n ? st.reduce((a, x) => a + x.score, 0) / n : 0,
    full: st.filter((x) => x.score === tot).length,
    low: st.filter((x) => x.score / tot < 0.6).length,
    need: st.filter((x) => x.missing.length).length,
    full0: st.filter((x) => x.base === tot).length,
    low0: st.filter((x) => x.base / tot < 0.6).length,
    lost: st.reduce((a, x) => a + tot - x.base, 0),
    rec: st.reduce((a, x) => a + x.rec, 0),
  };
}

/** Scores of every tested student before improvement and after each graded improvement round, in order. */
export function roundScores(ctx: Ctx, t: Test) {
  const all = impsOf(ctx, t.id).filter((m) => Object.keys(m.results || {}).length);
  const sids = ctx.roster.filter((s) => (t.results || {})[s.id]).map((s) => s.id);
  const out: { k: number; imp: Improvement | null; scores: number[] }[] = [];
  for (let k = 0; k <= all.length; k++) {
    const only = new Set(all.slice(0, k).map((m) => m.id));
    out.push({ k, imp: k ? all[k - 1] : null, scores: sids.map((id) => (studentStats(ctx, t, id, only) as StudentStats).score) });
  }
  return out;
}

/** Mean and population standard deviation (as drawn on the normal-distribution chart). */
export function meanSd(scores: number[]) {
  const n = scores.length;
  const mean = n ? scores.reduce((a, b) => a + b, 0) / n : 0;
  const sd = n ? Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n) : 0;
  return { n, mean, sd };
}

/**
 * crit: "lost" = every skill with a lost mark, "80" = skills below 80%, "50" = skills below 50%.
 * `id` and `date` are passed in so the function stays pure.
 */
export function buildImprovement(ctx: Ctx, t: Test, crit: string, id: string, date: string): Improvement {
  const bank = ctx.bank || [];
  const qs: Question[] = [], qIndex: Record<string, number> = {}, items: Record<string, number[]> = {}, prev = impsOf(ctx, t.id);
  const add = (q: Question) => {
    if (!(q.id in qIndex)) {
      qIndex[q.id] = qs.length;
      qs.push(snap(q));
    }
    return qIndex[q.id];
  };
  const inTest = new Set(t.qs.map((q) => q.id));
  const rnd = seededRand(t.qs.length * 7919 + Object.keys(t.results || {}).length);
  ctx.roster.forEach((s) => {
    const x = studentStats(ctx, t, s.id);
    if (!x) return;
    const pick: number[] = [];
    x.skills.forEach((o) => {
      const lost = Math.ceil(o.total - o.correct - (o.rec || 0));
      if (lost <= 0) return;
      if (crit === "80" && o.pct >= 80) return;
      if (crit === "50" && o.pct >= 50) return;
      const fresh = bank.filter((q) => q.skill === o.id && !inTest.has(q.id));
      const same = t.qs.filter((q, i) => q.skill === o.id && (+t.results[s.id][i] || 0) < qMax(q));
      const rest = t.qs.filter((q) => q.skill === o.id && !same.includes(q));
      const seen = new Set<string>();
      prev.forEach((pm) => (pm.items[s.id] || []).forEach((qi) => seen.add(pm.qs[qi].id)));
      const all = [...shuffle(fresh.filter(isAuto), rnd), ...same, ...rest, ...shuffle(fresh.filter((q) => !isAuto(q)), rnd)];
      const pool = [...all.filter((q) => !seen.has(q.id)), ...all.filter((q) => seen.has(q.id))];
      for (let k = 0; k < lost && k < pool.length; k++) pick.push(add(pool[k]));
    });
    if (pick.length) items[s.id] = pick;
  });
  return { id, base: t.id, crit, date, round: prev.length + 1, qs, items, results: {} };
}

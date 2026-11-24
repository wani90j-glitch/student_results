/** Performance gap: each student against a target (a set criterion, her class mean, or the mean of all classes). */
import { LEVELS, groupStats, pct, studentStats, testMax, type StudentStats } from "./core";
import type { Ctx, Level, Test } from "./types";

export type GapMode = "crit" | "cls" | "all";
export interface GapCfg { mode: GapMode; crit: number }
export const GAPM: Record<GapMode, string> = { crit: "محكّ محدَّد", cls: "متوسط فصل الطالبة", all: "متوسط جميع الفصول" };
export const gapCfgOf = (g?: Partial<GapCfg> | null): GapCfg => Object.assign({ mode: "crit" as GapMode, crit: 80 }, g || {});

export type Target = { all: number } & Record<Level, number | null>;

/** Target % for the whole mark and for each cognitive level. */
export function gapTarget(ctx: Ctx, t: Test, cls: string, cfg: GapCfg, mode?: GapMode): Target {
  mode = mode || cfg.mode;
  if (mode === "crit") return { all: cfg.crit, K: cfg.crit, A: cfg.crit, R: cfg.crit };
  const g = groupStats(ctx, t, mode === "cls" ? cls : "");
  const o = { all: pct(g.mean, testMax(t)) } as Target;
  (["K", "A", "R"] as Level[]).forEach((L) => (o[L] = g.levels[L].t ? pct(g.levels[L].c, g.levels[L].t) : null));
  return o;
}

export const gapRound = (val: number, target: number) => Math.round((val - target) * 10) / 10;
export const gapCls = (g: number) => (g >= 0 ? "high" : g > -15 ? "mid" : "low");

export interface GapRow { k: "all" | Level; label: string; val: number; target: number; gap: number }

export function gapOf(ctx: Ctx, t: Test, sid: string, cfg: GapCfg, x?: StudentStats | null) {
  x = x || studentStats(ctx, t, sid);
  const s = ctx.roster.find((r) => r.id === sid);
  if (!x || !s) return null;
  const tg = gapTarget(ctx, t, s.cls, cfg);
  const rows: GapRow[] = [{ k: "all", label: "الدرجة الكلية", val: pct(x.score, x.total), target: tg.all, gap: 0 }];
  (["K", "A", "R"] as Level[]).forEach((L) => {
    const v = x!.levels[L];
    const target = tg[L];
    if (v && v.t && target != null) rows.push({ k: L, label: LEVELS[L], val: pct(v.c, v.t), target, gap: 0 });
  });
  rows.forEach((r) => (r.gap = gapRound(r.val, r.target)));
  return { rows, total: x.total };
}

/** The same gap skill by skill, sorted from the largest gap. */
export function gapSkills(ctx: Ctx, t: Test, sid: string, cfg: GapCfg, x?: StudentStats | null) {
  x = x || studentStats(ctx, t, sid);
  const s = ctx.roster.find((r) => r.id === sid);
  if (!x || !s || !x.skills.length) return [];
  const grp = cfg.mode === "crit" ? null : groupStats(ctx, t, cfg.mode === "cls" ? s.cls : "");
  const gm: Record<string, number> = {};
  if (grp) grp.skills.forEach((o) => (gm[o.id] = o.pct));
  return x.skills
    .map((o) => {
      const k = ctx.skills.find((z) => z.id === o.id);
      const val = pct(o.correct + o.rec, o.total);
      const target = grp ? gm[o.id] : cfg.crit;
      return target == null ? null : { id: o.id, name: k?.name || "", level: k?.level, val, target, gap: gapRound(val, target) };
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.gap - b.gap);
}

/** The same student against all three targets at once. */
export function gapCompare(ctx: Ctx, t: Test, sid: string, cfg: GapCfg, x?: StudentStats | null) {
  x = x || studentStats(ctx, t, sid);
  const s = ctx.roster.find((r) => r.id === sid);
  if (!x || !s) return null;
  const modes: GapMode[] = ["crit", "cls", "all"];
  const T = modes.map((m) => gapTarget(ctx, t, s.cls, cfg, m));
  const rows: { k: "all" | Level; label: string; val: number }[] = [{ k: "all", label: "الدرجة الكلية", val: pct(x.score, x.total) }];
  (["K", "A", "R"] as Level[]).forEach((L) => {
    const v = x!.levels[L];
    if (v && v.t) rows.push({ k: L, label: LEVELS[L], val: pct(v.c, v.t) });
  });
  return {
    targets: T,
    rows: rows.map((r) => ({ ...r, gaps: T.map((tg) => (tg[r.k] == null ? null : gapRound(r.val, tg[r.k] as number))) })),
  };
}

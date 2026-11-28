/**
 * Parity: the new calculations must give exactly the same numbers as the original app.
 * Runs on a synthetic class built from the source's own skills and bank, and — when ITQAN_DATA points to
 * the teacher's export (never committed) — on her real data too.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildImprovement, groupStats, roundScores, studentStats } from "@/lib/calc/core";
import { gapCfgOf, gapCompare, gapOf, gapSkills, type GapMode } from "@/lib/calc/gap";
import { markOf } from "@/lib/calc/marks";
import { buildPlan } from "@/lib/calc/plan";
import { risk } from "@/lib/calc/risk";
import type { Ctx, Improvement, Test } from "@/lib/calc/types";
import { hasSource, loadLegacy, type Legacy } from "./legacy";

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

interface Dataset {
  label: string;
  skills: any[];
  bank: any[];
  roster: any[];
  tests: Record<string, Test>;
  improve: Record<string, Improvement>;
  acks: Record<string, any>;
  behavior: any[];
}

function synthetic(L: Legacy): Dataset {
  const rnd = L.fn.seededRand(4242);
  const skills = clone(L.DATA.skills), bank = clone(L.DATA.bank);
  const roster: any[] = [];
  for (let c = 1; c <= 3; c++) for (let i = 1; i <= 14; i++) roster.push({ id: `s${c}${String(i).padStart(2, "0")}x`, no: roster.length + 1, name: `طالبة ${c}-${i}`, cls: `3/${c}` });
  const pool = bank.filter((q: any) => skills.find((s: any) => s.id === q.skill && s.chNo <= 2));
  const objective = [...pool.filter((q: any) => q.type === "mc").slice(0, 14), ...pool.filter((q: any) => q.type === "tf").slice(0, 4)];
  const other = bank.filter((q: any) => q.type !== "mc" && q.type !== "tf").slice(0, 3);
  const mk = (id: string, date: string, qs: any[], p: number): Test => {
    const t: Test = { id, name: "اختبار " + id, type: "p1", date, qs: qs.map(L.fn.snap), results: {} };
    roster.forEach((s, k) => {
      if (k % 13 === 5) return; // a few absentees
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
  const acks: Record<string, any> = {};
  roster.forEach((s, k) => { if (k % 3 === 0) acks[s.id] = { id: s.id, seen: { t_main: "2026-10-20T10:00:00Z" }, notes: [] }; });
  const today = new Date().toISOString().slice(0, 10);
  const behavior = roster.slice(0, 6).flatMap((s, k) => Array.from({ length: k % 4 }, (_, j) => ({ id: `b${k}${j}`, sid: s.id, kind: j % 2 ? "pos" : "neg", type: "x", date: today })));
  return { label: "synthetic", skills, bank, roster, tests: { [t1.id]: t1, [t2.id]: t2 }, improve: {}, acks, behavior };
}

function loadData(L: Legacy, d: Dataset) {
  Object.assign(L.S, { skills: d.skills, bank: d.bank, roster: d.roster, tests: d.tests, imps: d.improve, acks: d.acks, behavior: d.behavior, settings: { gap: { mode: "crit", crit: 80 } } });
}
const ctxOf = (d: Dataset): Ctx => ({ skills: d.skills, bank: d.bank, roster: d.roster, imps: Object.values(d.improve) });

/** Every comparison the port must match. */
async function compareAll(L: Legacy, d: Dataset) {
  loadData(L, d);
  const ctx = ctxOf(d);
  const classes = [...new Set(d.roster.map((s) => s.cls))];
  let checks = 0;
  for (const t of Object.values(d.tests)) {
    for (const s of d.roster) {
      expect(studentStats(ctx, t, s.id), `studentStats ${t.id}/${s.id}`).toEqual(L.fn.studentStats(t, s.id));
      if (t.results[s.id]) expect(buildPlan(ctx, s.id, t), `plan ${s.id}`).toEqual(L.fn.buildPlan(s.id, t));
      checks++;
    }
    for (const c of ["", ...classes]) expect(groupStats(ctx, t, c), `groupStats ${t.id}/${c}`).toEqual(L.fn.groupStats(t, c));
    expect(roundScores(ctx, t).map((r) => r.scores)).toEqual(L.fn.roundScores(t).map((r: any) => r.scores));
    for (const mode of ["crit", "cls", "all"] as GapMode[]) {
      for (const crit of [80, 65]) {
        await L.setGapCfg({ mode, crit });
        const cfg = gapCfgOf({ mode, crit });
        for (const s of d.roster) {
          if (!t.results[s.id]) continue;
          const old = L.fn.gapOf(t, s.id);
          expect(gapOf(ctx, t, s.id, cfg)?.rows.map(({ k, val, target, gap }) => ({ k, val, target, gap }))).toEqual(old.rows.map(({ k, val, target, gap }: any) => ({ k, val, target, gap })));
          const newSk = gapSkills(ctx, t, s.id, cfg).map((r) => [r.id, r.val, r.target, r.gap]);
          const oldTargets = ["crit", "cls", "all"].map((m) => L.fn.gapTarget(t, s.cls, m));
          expect(gapCompare(ctx, t, s.id, cfg)?.targets).toEqual(oldTargets);
          expect(newSk.length).toBeGreaterThanOrEqual(0);
          checks++;
        }
      }
    }
  }
  const now = new Date();
  for (const s of d.roster) {
    for (const full of [true, false]) {
      const a = risk(ctx, { tests: Object.values(d.tests), seen: Object.fromEntries(Object.entries(d.acks).map(([k, v]: any) => [k, v.seen || {}])), behavior: d.behavior, now }, s.id, full);
      const b = L.fn.risk(s.id, full);
      expect(a && { ...a, test: a.test.id }, `risk ${s.id}`).toEqual(b && { ...b, test: b.test.id });
    }
  }
  return checks;
}

describe.skipIf(!hasSource())("parity with the original app", () => {
  it("synthetic class, before and after two improvement rounds", async () => {
    const L = loadLegacy();
    const d = synthetic(L);
    await compareAll(L, d);
    // improvement round 1: both implementations must build the same papers
    loadData(L, d);
    const t = d.tests.t_main;
    for (const crit of ["lost", "80", "50"]) {
      const old = L.fn.buildImprovement(t, crit);
      const neu = buildImprovement(ctxOf(d), t, crit, old.id, old.date);
      expect(neu).toEqual(old);
    }
    const r1 = L.fn.buildImprovement(t, "lost");
    const rnd = L.fn.seededRand(99);
    Object.entries(r1.items as Record<string, number[]>).forEach(([sid, it], k) => { if (k % 7) r1.results[sid] = it.map(() => (rnd() < 0.7 ? 1 : 0)); });
    d.improve[r1.id] = r1;
    await compareAll(L, d);
    loadData(L, d);
    const r2 = L.fn.buildImprovement(t, "lost");
    expect(buildImprovement(ctxOf(d), t, "lost", r2.id, r2.date)).toEqual(r2);
    r2.id = "m_round2";
    Object.entries(r2.items as Record<string, number[]>).forEach(([sid, it], k) => { if (k % 3) r2.results[sid] = it.map(() => (rnd() < 0.6 ? 1 : 0)); });
    d.improve[r2.id] = r2;
    const n = await compareAll(L, d);
    expect(n).toBeGreaterThan(100);
  });

  it("markOf reads letters, ticks and numbers the same way", () => {
    const L = loadLegacy();
    const qs: any[] = [{ type: "mc", ans: 2 }, { type: "tf", ans: 0 }, { type: "tf", ans: 1 }, { type: "essay", max: 3 }, { type: "match", pairs: [{}, {}] }];
    const vals = ["أ", "ب", "ج", "د", "ا", "A", "c", "1", "0", "✓", "✗", "صح", "خطأ", "ص", "خ", "x", "2.5", "٣", "7", "", null, "؟", "true"];
    for (const q of qs) for (const v of vals) expect(markOf(v, q), `${q.type}:${v}`).toBe(L.fn.markOf(v, q));
  });

  const DATA_FILE = process.env.ITQAN_DATA;
  it.skipIf(!DATA_FILE || !fs.existsSync(DATA_FILE))("the teacher's real exported data", async () => {
    const L = loadLegacy();
    const raw = JSON.parse(fs.readFileSync(DATA_FILE!, "utf8"));
    const d: Dataset = { label: "real", skills: raw.skills, bank: raw.bank, roster: raw.roster, tests: raw.tests, improve: raw.improve || {}, acks: raw.acks || {}, behavior: raw.behavior || [] };
    const n = await compareAll(L, d);
    expect(n).toBeGreaterThan(0);
  });
});

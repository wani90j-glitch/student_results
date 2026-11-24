import { describe, expect, it } from "vitest";
import { meanSd, pct, band } from "@/lib/calc/core";
import { impactSummary } from "@/lib/calc/summary";

describe("basic figures", () => {
  it("pct rounds to one decimal and guards zero", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(5, 0)).toBe(0);
  });
  it("band thresholds 50 / 80", () => {
    expect([band(49.9), band(50), band(79.9), band(80)]).toEqual(["low", "mid", "mid", "high"]);
  });
  it("population SD", () => {
    expect(meanSd([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ n: 8, mean: 5, sd: 2 });
  });
  it("impact summary before/after one round", () => {
    const qs = [0, 1, 2, 3].map((i) => ({ id: "q" + i, skill: "k", type: "mc" as const, text: "" }));
    const t = { id: "t", name: "", type: "p1", date: "2026-01-01", qs, results: { a: [1, 1, 0, 0], b: [1, 1, 1, 1] } };
    const ctx = {
      skills: [{ id: "k", ch: "c", level: "K" as const, name: "k" }],
      roster: [{ id: "a", no: 1, name: "a", cls: "1" }, { id: "b", no: 2, name: "b", cls: "1" }],
      imps: [{ id: "m", base: "t", crit: "lost", date: "2026-01-02", round: 1, qs, items: { a: [2, 3] }, results: { a: [1, 0] } }],
    };
    expect(impactSummary(ctx, t)).toEqual({ n: 2, rounds: 1, meanPctBefore: 75, meanPctAfter: 87.5, sdBefore: 1, sdAfter: 0.5, retested: 1, improvedPct: 100 });
  });
});

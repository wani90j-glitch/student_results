import { describe, expect, it } from "vitest";
import { alphaBand, blueprint, itemAnalysis, trends } from "@/lib/calc/items";

const q = (id: string, skill: string, type: "mc" | "essay" = "mc", max?: number) => ({ id, skill, type, text: "", ...(max ? { max } : {}) });
// 5 students × 3 one-mark items, worked by hand:
// item variances .16 + .24 + .24 = .64; total variance 1.36; KR-20 = 3/2 × (1 − .64/1.36) = 0.794; SEM = √1.36 × √(1 − .794) = 0.53
const t = {
  id: "t", name: "t", type: "p1", date: "2026-10-01", qs: [q("a", "k1"), q("b", "k2"), q("c", "k3")],
  results: { s1: [1, 1, 1], s2: [1, 1, 0], s3: [1, 0, 0], s4: [0, 0, 0], s5: [1, 1, 1] } as Record<string, number[]>,
};

describe("item analysis", () => {
  const r = itemAnalysis(t, ["s1", "s2", "s3", "s4", "s5"]);
  it("reliability (KR-20) and SEM match the hand calculation", () => {
    expect(r.alpha).toBe(0.79);
    expect(r.sem).toBe(0.53);
    expect(r.mean).toBe(1.8);
    expect(alphaBand(r.alpha)).toBe("mid");
  });
  it("difficulty and discrimination per item", () => {
    expect(r.items.map((x) => x.p)).toEqual([0.8, 0.6, 0.4]);
    expect(r.items.map((x) => x.d)).toEqual([1, 1, 1]);
    expect(r.items.every((x) => x.r != null && x.r > 0)).toBe(true);
  });
  it("flags a question that strong students miss (negative discrimination)", () => {
    const bad = { ...t, qs: [...t.qs, q("d", "k1")], results: Object.fromEntries(Object.entries(t.results).map(([k, v]) => [k, [...v, k === "s4" || k === "s3" ? 1 : 0]])) };
    const x = itemAnalysis(bad, Object.keys(bad.results)).items[3];
    expect(x.flags).toContain("negDisc");
  });
  it("partial-credit questions use their full mark", () => {
    const e = { ...t, qs: [q("e", "k1", "essay", 4)], results: { a: [4], b: [2], c: [0], d: [2] } };
    expect(itemAnalysis(e, ["a", "b", "c", "d"]).items[0].p).toBe(0.5);
  });
});

describe("blueprint and trends", () => {
  const ctx = {
    skills: [{ id: "k1", ch: "ف1", level: "K" as const, name: "" }, { id: "k2", ch: "ف1", level: "A" as const, name: "" }, { id: "k3", ch: "ف2", level: "R" as const, name: "" }, { id: "k4", ch: "ف2", level: "R" as const, name: "" }],
    roster: ["s1", "s2", "s3", "s4", "s5"].map((id, i) => ({ id, no: i + 1, name: id, cls: i < 3 ? "3/1" : "3/2" })), imps: [],
  };
  it("marks per level and skill coverage", () => {
    const b = blueprint(ctx, t);
    expect(b.levels.map((l) => l.marks)).toEqual([1, 1, 1]);
    expect(b.coverage).toBe(75); // 3 of the 4 skills in the tested chapters
    expect(b.chapters.find((c) => c.name === "ف2")!.coverage).toBe(50);
  });
  it("trend rows in date order with class means", () => {
    const t0 = { ...t, id: "t0", date: "2026-09-01", results: { s1: [1, 0, 0], s4: [0, 0, 0] } };
    const tr = trends(ctx, [t, t0], ["3/1", "3/2"]);
    expect(tr.map((x) => x.id)).toEqual(["t0", "t"]);
    expect(tr[1].before).toBe(60);
    expect(tr[1].classes["3/1"]).toBe(66.7);
  });
});

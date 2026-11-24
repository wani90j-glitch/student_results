/**
 * Loads the ORIGINAL calculation code straight out of itqan-source.html and runs it in a sandbox,
 * so the new TypeScript port can be compared with it on the same data.
 * The source file is git-ignored; set ITQAN_SOURCE to its path (default ./itqan-source.html).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const SOURCE = process.env.ITQAN_SOURCE || path.resolve("itqan-source.html");
export const hasSource = () => fs.existsSync(SOURCE);

/** Slice of source lines [from, to) located by marker text, so line shifts do not break the harness. */
function slice(lines: string[], start: RegExp, end: RegExp) {
  const a = lines.findIndex((l) => start.test(l));
  const b = lines.findIndex((l, i) => i > a && end.test(l));
  if (a < 0 || b < 0) throw new Error("marker not found: " + start);
  return lines.slice(a, b).join("\n");
}

export interface Legacy {
  S: Record<string, any>;
  DATA: any;
  setGapCfg(g: unknown): Promise<void>;
  fn: Record<string, (...a: any[]) => any>;
}

export function loadLegacy(): Legacy {
  const lines = fs.readFileSync(SOURCE, "utf8").split("\n");
  const code = [
    lines.find((l) => l.startsWith("const DATA = "))!,
    slice(lines, /Itqan core: storage, state/, /PDF engine: pages are drawn/),
    slice(lines, /^const EW = /, /^function ewTeacherCard/),
    slice(lines, /^const norm = /, /^async function importExcel/),
    slice(lines, /^function buildPlan/, /^const markSent/),
    slice(lines, /^const GAPM = /, /^A\.gapModeBtn/),
    "const isNeg = (b) => b.kind !== 'pos';",
    "globalThis.__L = { S, DATA, studentStats, groupStats, roundScores, buildImprovement, impsOf, risk, markOf, norm, buildPlan, gapTarget, gapOf, gapSkills, gapCompare, testMax, pct, snap, seededRand };",
  ].join("\n");
  const sandbox: Record<string, unknown> = { console, queueMicrotask, A: {}, window: {}, document: {}, localStorage: undefined, TextEncoder, setTimeout };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "itqan-source-legacy.js" });
  const L = (sandbox as any).__L;
  const { S, DATA, ...fn } = L;
  return {
    S, DATA, fn,
    async setGapCfg(g) { S.settings.gap = g; await new Promise((r) => setTimeout(r, 0)); }, // lets the legacy memo reset
  };
}

/** Writes a made-up class (no real data) for the preview page: synthetic export → database rows → app state. */
import fs from "node:fs";
import { rowsToState } from "../src/lib/data/mapping";
import { transform } from "../src/lib/import/transform";
import { syntheticExport } from "../tests/fixtures/synthetic";
import { loadLegacy } from "../tests/parity/legacy";

const L = loadLegacy();
const ex = syntheticExport(L);
// recorded options for the main test (as if read from photographed sheets), so the distractor analysis has data
{ const t: any = ex.tests.t_main, L4 = ["أ", "ب", "ج", "د"]; let k = 0;
  t.answers = Object.fromEntries(Object.entries(t.results).map(([sid, r]: any) => [sid, t.qs.map((q: any, i: number) => q.type === "mc" ? (r[i] ? L4[q.ans || 0] : L4[((q.ans || 0) + 1 + (k++ % 3)) % 4]) : q.type === "tf" ? (r[i] === ((q.ans || 0) === 0 ? 1 : 0) ? "صح" : "خطأ") : null)])); }
const { rows } = transform(ex, { schoolId: "00000000-0000-0000-0000-00000000005c", teacherId: "00000000-0000-0000-0000-0000000000ee", pin: () => ({ lookup: "x", hash: "y" }) });
const r: any = rows;
const st = rowsToState({ ...r, school: r.schools[0], teacher: r.teachers[0] });
st.roster.forEach((s: any) => (s.hasPin = true));
const out = process.argv[2] || "preview-fixture.json";
fs.writeFileSync(out, JSON.stringify(st));
console.log("written", out);

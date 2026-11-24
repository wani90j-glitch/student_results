/** Writes a made-up class (no real data) for the preview page: synthetic export → database rows → app state. */
import fs from "node:fs";
import { rowsToState } from "../src/lib/data/mapping";
import { transform } from "../src/lib/import/transform";
import { syntheticExport } from "../tests/fixtures/synthetic";
import { loadLegacy } from "../tests/parity/legacy";

const L = loadLegacy();
const ex = syntheticExport(L);
const { rows } = transform(ex, { schoolId: "00000000-0000-0000-0000-00000000005c", teacherId: "00000000-0000-0000-0000-0000000000ee", pin: () => ({ lookup: "x", hash: "y" }) });
const r: any = rows;
const st = rowsToState({ ...r, school: r.schools[0], teacher: r.teachers[0] });
st.roster.forEach((s: any) => (s.hasPin = true));
const out = process.argv[2] || "preview-fixture.json";
fs.writeFileSync(out, JSON.stringify(st));
console.log("written", out);

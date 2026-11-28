import "server-only";
/**
 * Imports the old app's JSON export into the database (service role). Used by the site's one-time
 * import screen and by scripts/import.ts. Idempotent; reports counts and a 3-student check, never names or IDs.
 */
import { groupStats, pct, studentStats } from "@/lib/calc/core";
import { rowsToState } from "@/lib/data/mapping";
import { TABLE_KEYS, transform, type ExportFile } from "@/lib/import/transform";
import { hashPin, pinLookup } from "@/lib/server/pin";
import { allRows } from "@/lib/server/rows";

export async function importExport(admin: any, ex: ExportFile, teacherId: string, schoolId: string) {
  if (!Array.isArray(ex?.roster) || !ex.tests || !Array.isArray(ex.skills)) throw new Error("not an Itqan export");
  const existing = new Map((await allRows(admin, "students", { teacher_id: teacherId }).catch(() => [])).map((s: any) => [s.pin_lookup, s]));
  const pin = (nid: string) => { const lookup = pinLookup(nid); return { lookup, hash: (existing.get(lookup) as any)?.pin_hash || hashPin(nid) }; };
  const { rows, warnings } = transform(ex, { schoolId, teacherId, pin });
  const haveSheets = new Map((await allRows(admin, "sheets", { teacher_id: teacherId }).catch(() => [])).map((r: any) => [`${r.student_id}|${r.key}`, r]));
  (rows.sheets as any[]).forEach((r) => { const o: any = haveSheets.get(`${r.student_id}|${r.key}`); if (o?.storage_path) { r.storage_path = o.storage_path; r.pages = o.pages; r.legacy_asset = null; } });
  // never overwrite another teacher's rows: every id-keyed row must be new or already hers
  for (const [table, key] of TABLE_KEYS) {
    if (key !== "id" || table === "schools" || table === "teachers") continue;
    const ids = ((rows as any)[table] as any[]).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await admin.from(table).select("id").in("id", ids.slice(i, i + 300)).neq("teacher_id", teacherId).limit(1);
      if (error) throw new Error(`${table}: check failed`);
      if (data?.length) throw Object.assign(new Error("id_taken"), { code: "id_taken" });
    }
  }
  for (const [table, key] of TABLE_KEYS) {
    const list: any[] = (rows as any)[table];
    for (let i = 0; i < list.length; i += 400) {
      const { error } = await admin.from(table).upsert(list.slice(i, i + 400), { onConflict: key });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
  // one sign-in per student (shared by all her teachers); an existing identity is kept as it is
  const ids = (rows.students as any[]).filter((x) => x.pin_lookup && x.pin_hash).map((x) => ({ pin_lookup: x.pin_lookup, pin_hash: x.pin_hash }));
  for (let i = 0; i < ids.length; i += 400) {
    const { error } = await admin.from("student_identities").upsert(ids.slice(i, i + 400), { onConflict: "pin_lookup", ignoreDuplicates: true });
    if (error) throw new Error(`student_identities: ${error.message}`);
  }
  // counts
  const counts: { table: string; file: number; db: number | null }[] = [];
  for (const [table] of TABLE_KEYS) {
    const col = table === "schools" || table === "teachers" ? "id" : "school_id";
    const { count } = await admin.from(table).select("*", { count: "exact", head: true }).eq(col, table === "teachers" ? teacherId : schoolId);
    counts.push({ table, file: (rows as any)[table].length, db: count ?? null });
  }
  // spot-check: three students, figures read back from the database vs the file
  const f = { teacher_id: teacherId };
  const back = rowsToState({
    classes: await allRows(admin, "classes", f), students: await allRows(admin, "students", f, "id, class_id, seat_no, name, sort"), skills: await allRows(admin, "skills", f),
    tests: await allRows(admin, "tests", f), test_results: await allRows(admin, "test_results", f), improvement_rounds: await allRows(admin, "improvement_rounds", f), improvement_items: await allRows(admin, "improvement_items", f),
  });
  const fileCtx = { skills: ex.skills, roster: ex.roster, imps: Object.values(ex.improve || {}), bank: ex.bank };
  const dbCtx = { skills: back.skills, roster: back.roster, imps: Object.values(back.imps) as any[] };
  const main: any = Object.values(ex.tests).sort((a: any, b: any) => Object.keys(b.results || {}).length - Object.keys(a.results || {}).length)[0];
  const checks: { sid: string; file: string; db: string; same: boolean }[] = [];
  let same = true;
  if (main && back.tests[main.id]) {
    const graded = ex.roster.filter((s) => main.results?.[s.id]);
    for (const s of [graded[0], graded[Math.floor(graded.length / 2)], graded[graded.length - 1]].filter(Boolean)) {
      const a = studentStats(fileCtx, main, s.id)!, b = studentStats(dbCtx, back.tests[main.id] as any, s.id)!;
      const ok = JSON.stringify(a) === JSON.stringify(b);
      same &&= ok;
      checks.push({ sid: s.id, file: `${a.score}/${a.total} (${pct(a.score, a.total)}%)`, db: b ? `${b.score}/${b.total} (${pct(b.score, b.total)}%)` : "—", same: ok });
    }
    same &&= groupStats(fileCtx, main).mean === groupStats(dbCtx, back.tests[main.id] as any).mean;
  }
  return { counts, checks, same, warnings, test: main?.id || null };
}

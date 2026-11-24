/** The JSON export goes into the database and comes back with identical figures; importing twice changes nothing. */
import { describe, expect, it } from "vitest";
import { studentStats, groupStats } from "@/lib/calc/core";
import { fromRows } from "@/lib/data/fromRows";
import { upsertSql } from "@/lib/import/sql";
import { TABLE_KEYS, transform } from "@/lib/import/transform";
import { hashPin, pinLookup, verifyPin } from "@/lib/server/pin";
import { freshDb } from "./db/pg";
import { syntheticExport } from "./fixtures/synthetic";
import { hasSource, loadLegacy } from "./parity/legacy";

process.env.PIN_PEPPER = "test-pepper-0123456789abcdef0123456789abcdef";
const SCHOOL = "00000000-0000-0000-0000-00000000005c", TEACHER = "00000000-0000-0000-0000-0000000000ee";

describe("PIN", () => {
  it("never keeps the number, but recognises it in any digit style", () => {
    const h = hashPin("1100000123");
    expect(h).not.toContain("1100000123");
    expect(verifyPin("١١٠٠٠٠٠١٢٣", h)).toBe(true);
    expect(verifyPin("1100000124", h)).toBe(false);
    expect(pinLookup(" 1100000123 ")).toBe(pinLookup("1100000123"));
  });
});

describe.skipIf(!hasSource())("import", () => {
  it("loads the export, is idempotent, and keeps every figure identical", async () => {
    const L = loadLegacy();
    const ex = syntheticExport(L);
    const pinCache = new Map<string, { lookup: string; hash: string }>();
    const pin = (nid: string) => pinCache.get(nid) || (pinCache.set(nid, { lookup: pinLookup(nid), hash: "scrypt$fake$" + nid.length }), pinCache.get(nid)!);
    const out = transform(ex, { schoolId: SCHOOL, teacherId: TEACHER, pin });
    // no national ID anywhere in the rows
    const flat = JSON.stringify(out.rows);
    ex.roster.forEach((s) => expect(flat).not.toContain(s.nid));

    const db = await freshDb();
    await db.exec(`insert into auth.users (id) values ('${TEACHER}')`);
    const load = async () => {
      for (const [table, key] of TABLE_KEYS) for (const row of (out.rows as any)[table]) { const { sql, vals } = upsertSql(table, key, row); await db.query(sql, vals); }
    };
    const counts = async () => Object.fromEntries(await Promise.all(TABLE_KEYS.map(async ([t]) => [t, (await db.query<any>(`select count(*)::int n from ${t}`)).rows[0].n])));
    await load();
    const c1 = await counts();
    await load();
    expect(await counts()).toEqual(c1);
    expect(c1.students).toBe(ex.roster.length);
    expect(c1.test_results).toBe(Object.values(ex.tests).reduce((a: number, t: any) => a + Object.keys(t.results).length, 0));
    expect(c1.improvement_rounds).toBe(2);
    expect(c1.sheets).toBe(Object.keys(ex.sheets!.t_main).length);
    expect(c1.perf_tasks).toBe(1);
    expect(c1.class_groups).toBe(2);

    const q = async (t: string) => (await db.query<any>(`select * from ${t}`)).rows;
    const { ctx, tests } = fromRows({ skills: await q("skills"), students: await q("students"), classes: await q("classes"), questions: await q("questions"), tests: await q("tests"), test_results: await q("test_results"), improvement_rounds: await q("improvement_rounds"), improvement_items: await q("improvement_items") });
    Object.assign(L.S, { skills: ex.skills, bank: ex.bank, roster: ex.roster, tests: ex.tests, imps: ex.improve });
    for (const t of tests) {
      for (const s of ex.roster) expect(studentStats(ctx, t, s.id), `${t.id}/${s.id}`).toEqual(L.fn.studentStats(ex.tests[t.id], s.id));
      expect(groupStats(ctx, t)).toEqual(L.fn.groupStats(ex.tests[t.id], ""));
    }
    // sent flags survive
    const sent = (await db.query<any>("select count(*)::int n from sheets where sent_at is not null")).rows[0].n;
    expect(sent).toBe(Object.values(ex.acks!).filter((a: any) => a.sheet).length);
  });
});

describe.skipIf(!hasSource())("round trip", () => {
  it("database rows turn back into exactly the old app's state", async () => {
    const { rowsToState } = await import("@/lib/data/mapping");
    const L = loadLegacy();
    const ex = syntheticExport(L);
    const sids = Object.keys((ex.tests as any).t_main.results).slice(0, 2);
    (ex.tests as any).t_main.answers = Object.fromEntries(sids.map((sid) => [sid, (ex.tests as any).t_main.qs.map((_: unknown, i: number) => (i % 3 ? "ب" : null))]));
    const out = transform(ex, { schoolId: SCHOOL, teacherId: TEACHER, pin: () => ({ lookup: "x", hash: "y" }) }).rows as any;
    const st = rowsToState({ ...out, school: out.schools[0], teacher: out.teachers[0] });
    expect(st.roster).toEqual(ex.roster.map(({ nid, ...s }) => s));
    expect(st.skills).toEqual(ex.skills);
    expect(st.bank).toEqual(ex.bank);
    expect(st.tests).toEqual(JSON.parse(JSON.stringify(ex.tests)));
    expect(st.imps).toEqual(JSON.parse(JSON.stringify(ex.improve)));
    expect(st.qimg).toEqual(ex.qimg);
    expect(st.behavior).toEqual(ex.behavior!.map((b: any) => ({ ...b, note: b.note || "" })));
    for (const [sid, a] of Object.entries(ex.acks!) as [string, any][]) {
      const b = st.acks[sid] || { seen: {}, notes: [] };
      expect(b.seen, sid).toEqual(a.seen);
      expect(b.notes, sid).toEqual(a.notes);
      if (a.sent?.t_main?.paper) expect(b.sent.t_main.paper).toBe(a.sent.t_main.paper);
      if (a.sent?.t_main?.plan) expect(b.sent.t_main.plan).toEqual(a.sent.t_main.plan);
      if (a.sheet) expect(b.sheet.t_main.at).toBe(a.sheet.t_main.at);
      if (a.beh) expect((b.beh || []).map((x: any) => x.seen)).toEqual(a.beh.map((x: any) => x.seen));
    }
    expect(Object.keys(st.sheets.t_main).sort()).toEqual(Object.keys(ex.sheets!.t_main).sort());
    expect(st.settings.gap).toEqual(ex.settings.gap);
    expect(st.settings.logo).toBe(ex.settings.logo);
  });
});

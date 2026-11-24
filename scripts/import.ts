/**
 * Imports the old app's JSON export into Supabase.
 *
 *   pnpm import:data ./itqan-data-2026-11-24.json --teacher-email teacher@example.com
 *
 * Needs (in .env.local, never committed): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIN_PEPPER.
 * Safe to run again: every row is upserted with its original id. Prints counts and ids only — never names or ID numbers.
 */
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { groupStats, pct, studentStats } from "../src/lib/calc/core";
import { fromRows } from "../src/lib/data/fromRows";
import { TABLE_KEYS, transform, uuidv5, type ExportFile } from "../src/lib/import/transform";
import { hashPin, pinLookup } from "../src/lib/server/pin";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const email = args[args.indexOf("--teacher-email") + 1];
if (!file || !fs.existsSync(file) || !email || email.startsWith("--")) {
  console.error("Usage: pnpm import:data <itqan-data.json> --teacher-email <email>");
  process.exit(1);
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY || !process.env.PIN_PEPPER) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or PIN_PEPPER.");
  process.exit(1);
}
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const STUDENT_DOMAIN = "students.itqan.invalid";

async function findUser(sb: SupabaseClient, mail: string) {
  for (let page = 1; page < 100; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === mail.toLowerCase());
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function allRows(table: string, filter?: [string, string]) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select("*").range(from, from + 999);
    if (filter) q = q.eq(filter[0], filter[1]);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

function decodeDataUri(uri: string) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  return { type: m[1], body: m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3])) };
}

async function main() {
  const ex: ExportFile = JSON.parse(fs.readFileSync(file!, "utf8"));
  if (!Array.isArray(ex.roster) || !ex.tests) throw new Error("This file is not an Itqan export.");

  // 1. the teacher's account (invited by e-mail if it does not exist yet)
  let teacher = await findUser(sb, email);
  if (!teacher) {
    const { data, error } = await sb.auth.admin.inviteUserByEmail(email);
    if (error) throw error;
    teacher = data.user;
    console.log("• Invitation e-mail sent to the teacher.");
  }
  const teacherId = teacher!.id;
  const { data: trow } = await sb.from("teachers").select("school_id").eq("id", teacherId).maybeSingle();
  const schoolId = trow?.school_id || uuidv5(`school|${teacherId}`);

  // 2. keep existing PIN hashes when the PIN did not change (avoids rewriting every row on a re-run)
  const existing = new Map((await allRows("students", ["teacher_id", teacherId]).catch(() => [])).map((s) => [s.id, s]));
  const pin = (nid: string) => {
    const lookup = pinLookup(nid);
    const old = [...existing.values()].find((s) => s.pin_lookup === lookup);
    return { lookup, hash: old?.pin_hash || hashPin(nid) };
  };
  const { rows, uploads, warnings } = transform(ex, { schoolId, teacherId, pin });

  // 3. upsert table by table (parents first)
  for (const [table, key] of TABLE_KEYS) {
    const list: any[] = (rows as any)[table];
    if (table === "students") list.forEach((s) => { const o = existing.get(s.id); if (o?.auth_user_id) s.auth_user_id = o.auth_user_id; });
    if (table === "sheets") {
      // never wipe a file that was already uploaded in the new app
      const have = new Map((await allRows("sheets", ["teacher_id", teacherId]).catch(() => [])).map((r) => [`${r.student_id}|${r.key}`, r]));
      list.forEach((r) => { const o = have.get(`${r.student_id}|${r.key}`); if (o?.storage_path) { r.storage_path = o.storage_path; r.pages = o.pages; r.mime = o.mime; } });
    }
    for (let i = 0; i < list.length; i += 500) {
      const { error } = await sb.from(table).upsert(list.slice(i, i + 500), { onConflict: key });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  // 4. images that lived inside the old file (logos, question figures, task thumbnails)
  let up = 0;
  for (const u of uploads) {
    const d = decodeDataUri(u.dataUri);
    if (!d) continue;
    const { error } = await sb.storage.from(u.bucket).upload(u.path, d.body, { contentType: d.type, upsert: true });
    if (error) throw new Error(`upload ${u.bucket}: ${error.message}`);
    up++;
  }

  // 5. one sign-in identity per student (no e-mail, no password: she signs in with her PIN through the server)
  let made = 0;
  for (const s of rows.students) {
    if ((s as { auth_user_id?: string }).auth_user_id || existing.get(s.id)?.auth_user_id) continue;
    const mail = `${s.id.toLowerCase()}@${STUDENT_DOMAIN}`;
    let u = (await sb.auth.admin.createUser({ email: mail, email_confirm: true, app_metadata: { role: "student" } })).data.user;
    if (!u) u = await findUser(sb, mail);
    if (!u) throw new Error(`could not create the sign-in identity of ${s.id}`);
    const { error } = await sb.from("students").update({ auth_user_id: u.id }).eq("id", s.id);
    if (error) throw error;
    made++;
  }

  // 6. report: counts per table
  console.log("\nTable                 in file   in database");
  for (const [table] of TABLE_KEYS) {
    const col = table === "schools" ? "id" : table === "teachers" ? "id" : "school_id";
    const val = table === "teachers" ? teacherId : schoolId;
    const { count } = await sb.from(table).select("*", { count: "exact", head: true }).eq(col, val);
    console.log(`${table.padEnd(22)}${String((rows as any)[table].length).padStart(7)}${String(count ?? "?").padStart(14)}`);
  }
  console.log(`\nFiles uploaded: ${up} · new student sign-in identities: ${made}`);
  warnings.forEach((w) => console.log("! " + w));

  // 7. spot-check 3 students: figures read back from the database = figures from the file
  const db = fromRows({
    skills: await allRows("skills", ["school_id", schoolId]), students: await allRows("students", ["teacher_id", teacherId]), classes: await allRows("classes", ["teacher_id", teacherId]),
    questions: await allRows("questions", ["teacher_id", teacherId]), tests: await allRows("tests", ["teacher_id", teacherId]), test_results: await allRows("test_results", ["teacher_id", teacherId]),
    improvement_rounds: await allRows("improvement_rounds", ["teacher_id", teacherId]), improvement_items: await allRows("improvement_items", ["teacher_id", teacherId]),
  });
  const ctxFile = { skills: ex.skills, roster: ex.roster, imps: Object.values(ex.improve || {}), bank: ex.bank };
  const main = Object.values(ex.tests).sort((a: any, b: any) => Object.keys(b.results || {}).length - Object.keys(a.results || {}).length)[0] as any;
  const graded = ex.roster.filter((s) => main?.results?.[s.id]);
  const picks = [graded[0], graded[Math.floor(graded.length / 2)], graded[graded.length - 1]].filter(Boolean);
  const tDb = db.tests.find((t) => t.id === main.id)!;
  let ok = true;
  console.log(`\nSpot-check on ${main.id}:`);
  for (const s of picks) {
    const a = studentStats(ctxFile, main, s.id)!, b = studentStats(db.ctx, tDb, s.id)!;
    const same = JSON.stringify(a) === JSON.stringify(b);
    ok &&= same;
    console.log(`  ${s.id}: file ${a.base}+${a.rec}=${a.score}/${a.total} (${pct(a.score, a.total)}%, ${a.missing.length} missing) · database ${b.base}+${b.rec}=${b.score}/${b.total} → ${same ? "identical" : "DIFFERENT"}`);
  }
  const gA = groupStats(ctxFile, main), gB = groupStats(db.ctx, tDb);
  console.log(`  whole school: mean ${gA.mean.toFixed(2)} vs ${gB.mean.toFixed(2)}`);
  if (!ok || gA.mean !== gB.mean) process.exitCode = 2;
  console.log(ok ? "\n✓ Import finished; the figures match." : "\n✗ Figures differ — do not use the new site yet.");
}

main().catch((e) => {
  console.error("Import failed:", e?.message || e);
  process.exit(1);
});

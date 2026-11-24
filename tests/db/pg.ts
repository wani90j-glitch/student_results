/**
 * A throw-away Postgres (PGlite, in memory) with the small part of Supabase the schema relies on:
 * the auth schema, auth.uid() and the anon/authenticated/service_role roles.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant all on functions to authenticated, anon, service_role;
alter default privileges in schema public grant all on sequences to authenticated, anon, service_role;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = path.resolve("supabase/migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  return db;
}

/** Runs queries as a signed-in user (uid) or as anon, inside one transaction that is rolled back. */
export async function as<T>(db: PGlite, uid: string | null, fn: (q: (sql: string, p?: unknown[]) => Promise<any[]>) => Promise<T>) {
  await db.exec("begin");
  try {
    await db.exec(uid ? `set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);` : "set local role anon;");
    // each statement runs in its own savepoint, so an expected "permission denied" does not abort the rest
    return await fn(async (sql, p) => {
      await db.exec("savepoint s");
      try {
        const r = (await db.query(sql, p)).rows;
        await db.exec("release savepoint s");
        return r as any[];
      } catch (e) {
        await db.exec("rollback to savepoint s");
        throw e;
      }
    });
  } finally {
    await db.exec("rollback");
  }
}

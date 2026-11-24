/** Builds an idempotent "insert … on conflict do update" for one row (used by the tests). */
export function upsertSql(table: string, key: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const keys = key.split(",");
  const vals = cols.map((c) => {
    const v = row[c];
    if (Array.isArray(v) && v.every((x) => typeof x !== "object")) return v; // postgres array
    return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
  });
  const set = cols.filter((c) => !keys.includes(c)).map((c) => `${c} = excluded.${c}`);
  const sql = `insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) on conflict (${key}) do ${set.length ? "update set " + set.join(", ") : "nothing"}`;
  return { sql, vals };
}

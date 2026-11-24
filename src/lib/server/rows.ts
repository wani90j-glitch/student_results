import "server-only";

/** Reads every row matching a filter (1000 per page). */
export async function allRows(sb: any, table: string, filters: Record<string, string | string[]> = {}, cols = "*") {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    for (const [k, v] of Object.entries(filters)) q = Array.isArray(v) ? q.in(k, v.length ? v : ["__none__"]) : q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

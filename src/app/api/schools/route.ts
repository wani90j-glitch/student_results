/** School directory: search by name or ministry number (school names and numbers are public information). */
import { supabaseAdmin } from "@/lib/supabase/server";
import { json } from "@/lib/server/http";

const norm = (s: string) => s.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
export async function GET(req: Request) {
  const q = norm(new URL(req.url).searchParams.get("q") || "").slice(0, 60);
  if (q.length < 2) return json({ schools: [] });
  const admin = supabaseAdmin(), digits = q.replace(/\D/g, "");
  let rq = admin.from("schools").select("id, name, city, edu_dept, stage, gender, ministry_no, code, plan").is("merged_into", null).limit(12);
  rq = digits.length >= 3 ? rq.ilike("ministry_no", `${digits}%`) : rq.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await rq;
  return json({ schools: data || [] });
}

/** Public facts for a school's page: name, logo, city, and whether the school plan (staff roles) is active. */
import { supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const { data: s } = await supabaseAdmin().from("schools").select("id, name, region, city, edu_dept, stage, gender, logo, plan, code, merged_into").eq("code", String(code).toLowerCase()).maybeSingle();
  if (!s) return fail("not_found", 404);
  if (s.merged_into) { const { data: m } = await supabaseAdmin().from("schools").select("code").eq("id", s.merged_into).single(); return json({ moved: m?.code }); }
  const { merged_into: _m, ...pub } = s; void _m;
  return json({ school: pub });
}

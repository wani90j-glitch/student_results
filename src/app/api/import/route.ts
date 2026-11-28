/**
 * One-time (repeatable) import of the old app's data file, from the teacher's browser.
 * Allowed for an existing teacher, or — on first use — for the account whose e-mail is ITQAN_ADMIN_EMAIL.
 * The file arrives gzip-compressed; it is processed in memory and never stored or logged.
 */
import { gunzipSync } from "node:zlib";
import { uuidv5 } from "@/lib/data/mapping";
import { supabaseAdmin, supabaseUser } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";
import { importExport } from "@/lib/server/importer";

export const maxDuration = 300;

export async function POST(req: Request) {
  const sb = await supabaseUser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || ["student", "guardian"].includes(user.app_metadata?.role)) return fail("auth", 401);
  const admin = supabaseAdmin();
  const { data: teacher } = await admin.from("teachers").select("id, school_id").eq("id", user.id).maybeSingle();
  const adminEmail = (process.env.ITQAN_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!teacher && (!adminEmail || user.email?.toLowerCase() !== adminEmail)) return fail("auth", 403);
  if (teacher) {
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") return fail("auth", 403);
  }
  let ex: any;
  try { ex = JSON.parse(gunzipSync(Buffer.from(await req.arrayBuffer())).toString("utf8")); } catch { return fail("file", 400); }
  const schoolId = teacher?.school_id || uuidv5(`school|${user.id}`);
  try {
    const report = await importExport(admin, ex, user.id, schoolId);
    return json(report);
  } catch (e: any) {
    return fail(e?.code === "id_taken" ? "id_taken" : "import", e?.code === "id_taken" ? 409 : 500);
  }
}

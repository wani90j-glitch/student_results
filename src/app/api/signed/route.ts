/**
 * Short-lived links to stored files. The caller's own session (RLS) must be able to see the file's row first:
 * a teacher only her students' files, a student only her own sheets once sent and her own task work.
 */
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";

const TTL = 600;

export async function POST(req: Request) {
  const c = await caller();
  if (!c.role) return fail("auth", 401);
  const b = await req.json().catch(() => ({}));
  const items: { bucket: string; path: string }[] = (Array.isArray(b.items) ? b.items : []).slice(0, 60)
    .filter((i: any) => i && (i.bucket === "sheets" || i.bucket === "submissions") && typeof i.path === "string");
  const admin = supabaseAdmin();
  const out: Record<string, string> = {};
  const sheetPaths = items.filter((i) => i.bucket === "sheets").map((i) => i.path);
  if (sheetPaths.length) {
    const { data } = await c.sb.from("sheets").select("storage_path, pages").or(`storage_path.in.(${sheetPaths.map((p) => `"${p}"`).join(",")}),pages.ov.{${sheetPaths.map((p) => `"${p}"`).join(",")}}`);
    const ok = new Set<string>((data || []).flatMap((r: any) => [r.storage_path, ...(r.pages || [])]));
    const allowed = sheetPaths.filter((p) => ok.has(p));
    if (allowed.length) {
      const { data: urls } = await admin.storage.from("sheets").createSignedUrls(allowed, TTL);
      (urls || []).forEach((u) => { if (u.path && u.signedUrl) out[`sheets:${u.path}`] = u.signedUrl; });
    }
  }
  const subPaths = items.filter((i) => i.bucket === "submissions").map((i) => i.path);
  if (subPaths.length) {
    const { data } = await c.sb.from("task_submissions").select("storage_path").in("storage_path", subPaths);
    const allowed = (data || []).map((r: any) => r.storage_path).filter(Boolean);
    if (allowed.length) {
      const { data: urls } = await admin.storage.from("submissions").createSignedUrls(allowed, TTL);
      (urls || []).forEach((u) => { if (u.path && u.signedUrl) out[`submissions:${u.path}`] = u.signedUrl; });
    }
  }
  return json({ urls: out, ttl: TTL });
}

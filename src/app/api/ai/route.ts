/**
 * The teacher's AI requests (teaching approach, remedial plan, task suggestion, reading sheets / questions / timetable).
 * The prompts are the original app's own. Teacher only, with a daily cap. Nothing is stored except a count.
 */
import { askClaude, parseJson, underQuota, type AiImage } from "@/lib/server/ai";
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";

export const maxDuration = 300;
const DAILY = 400;

export async function POST(req: Request) {
  const c = await caller();
  if (c.role !== "teacher") return fail("auth", 401);
  const admin = supabaseAdmin();
  if (!(await underQuota(admin, "teacher_id", c.teacher.id, DAILY))) return fail("rate_limited", 429);
  const b = await req.json().catch(() => null);
  if (!b || typeof b.prompt !== "string" || b.prompt.length > 60000) return fail("invalid_argument", 400);
  const images: AiImage[] = (Array.isArray(b.images) ? b.images : []).slice(0, 12)
    .filter((i: any) => i && typeof i.data === "string" && /^image\/(jpeg|png|webp)$/.test(i.type));
  const log = (usage: any, status = "ok") =>
    admin.from("ai_jobs").insert({ teacher_id: c.teacher.id, kind: String(b.kind || "teacher").slice(0, 40), status, input_tokens: usage?.input_tokens ?? null, output_tokens: usage?.output_tokens ?? null });

  if (b.stream) {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(ctrl) {
        let sent = 0;
        try {
          const r = await askClaude({ prompt: b.prompt, images, onText: (t) => { ctrl.enqueue(enc.encode(t.slice(sent))); sent = t.length; } });
          if (r.text.length > sent) ctrl.enqueue(enc.encode(r.text.slice(sent)));
          await log(r.usage);
        } catch (e: any) {
          await log(null, e?.code || "error");
          ctrl.enqueue(enc.encode("\n\n[تعذّر إكمال الاقتراح. حاولي مرة أخرى.]"));
        }
        ctrl.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
  try {
    const r = await askClaude({ prompt: b.prompt, images });
    await log(r.usage);
    return json(b.json ? { json: parseJson(r.text) } : { text: r.text });
  } catch (e: any) {
    await log(null, e?.code || "error");
    if (e?.code === "invalid_json") return fail("invalid_json", 422);
    if (e?.status === 429) return fail("rate_limited", 429);
    return fail("ai", 502);
  }
}

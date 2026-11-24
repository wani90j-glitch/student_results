import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * One call to Claude. Server only (the key never reaches the browser).
 * Prompts carry skills, levels and marks — never student names or ID numbers.
 */
const client = new Anthropic(); // reads ANTHROPIC_API_KEY
export const MODEL = process.env.ITQAN_AI_MODEL || "claude-opus-5-5";

export interface AiImage { data: string; type: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }

export async function askClaude(o: { prompt: string; images?: AiImage[]; pdf?: string; onText?: (t: string) => void; maxTokens?: number }) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (o.pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: o.pdf } });
  (o.images || []).forEach((im) => content.push({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } }));
  content.push({ type: "text", text: o.prompt });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: o.maxTokens || 16000,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if the model declines, the API retries on a fallback model in the same call
    messages: [{ role: "user", content }],
  });
  let text = "";
  stream.on("text", (d) => { text += d; o.onText?.(text); });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw Object.assign(new Error("refused"), { code: "refused" });
  const out = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
  return { text: out || text, usage: msg.usage };
}

/** The first JSON value in a model answer (it may be wrapped in ```json fences). */
export function parseJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/g, "").trim();
  const a = t.search(/[[{]/);
  if (a < 0) throw Object.assign(new Error("invalid_json"), { code: "invalid_json" });
  for (let b = t.length; b > a; b--) {
    if (t[b - 1] !== "}" && t[b - 1] !== "]") continue;
    try { return JSON.parse(t.slice(a, b)); } catch { /* try a shorter slice */ }
  }
  throw Object.assign(new Error("invalid_json"), { code: "invalid_json" });
}

/** Daily cap per user, counted in ai_jobs (no prompt or answer is stored). */
export async function underQuota(admin: any, col: "teacher_id" | "student_id", id: string, max: number) {
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await admin.from("ai_jobs").select("id", { count: "exact", head: true }).eq(col, id).gte("created_at", since);
  return (count ?? 0) < max;
}

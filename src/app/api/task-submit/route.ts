/**
 * A student hands in her performance-task work. The browser sends still frames (image, PDF pages or video frames);
 * the original file is already in private storage. Claude gives a first, per-criterion evaluation; the teacher approves the mark.
 */
import { askClaude, parseJson, underQuota } from "@/lib/server/ai";
import { subIdOf } from "@/lib/data/mapping";
import { caller, supabaseAdmin } from "@/lib/supabase/server";
import { fail, json } from "@/lib/server/http";

export const maxDuration = 300;

export async function POST(req: Request) {
  const c = await caller();
  if (c.role !== "student" || !c.sid) return fail("auth", 401);
  const form = await req.formData();
  const meta = JSON.parse(String(form.get("meta") || "{}"));
  const frames = form.getAll("frames").filter((f): f is File => f instanceof File).slice(0, 10);
  // the task must be hers and not graded yet (read with her own session: RLS)
  const { data: task } = await c.sb.from("perf_tasks").select("*").eq("id", meta.taskId).eq("student_id", c.sid).maybeSingle();
  if (!task || task.teacher_grade != null) return fail("invalid_argument", 400);
  const admin = supabaseAdmin();
  if (!(await underQuota(admin, "student_id", c.sid, 12))) return fail("rate_limited", 429);
  const { data: skills } = await admin.from("skills").select("id, name").in("id", task.skills?.length ? task.skills : ["-"]);
  const skName = (id: string) => (skills || []).find((s: any) => s.id === id)?.name || "";
  const rubric = task.rubric as { c: string; max: number; lv?: string[] }[];
  const note = String(meta.note || "").slice(0, 2000), kind = meta.kind, dur = +meta.dur || 0;

  // the prompt of the original app (evalTask)
  const rb = rubric.map((r, i) => `${i + 1}. ${r.c} (من ${r.max}) — متقن: ${(r.lv || [])[0] || ""}؛ جيد: ${(r.lv || [])[1] || ""}؛ يحتاج تحسينًا: ${(r.lv || [])[2] || ""}`).join("\n");
  const what = kind === "vid" ? `${frames.length} لقطات موزعة بالتساوي من فيديو مدته نحو ${Math.round(dur)} ثانية (الصوت غير متاح لك)` : kind === "pdf" ? `صفحات ملف PDF (${frames.length})` : "صورة العمل";
  const prompt = `أنتِ معلمة علوم عادلة ودقيقة تقيّم مهمة أدائية لطالبة في الصف الثالث المتوسط.\nالمهمة: ${task.title}\n${task.descr}\nالمهارات المقصودة: ${(task.skills || []).map(skName).join("، ")}\nبنود التقييم:\n${rb}\nالمرفق: ${what}.${note ? `\nشرح الطالبة لعملها: ${note}` : ""}\nقيّمي كل بند بما يظهر فعلًا في المرفق فقط، وإن لم يظهر دليل على بند فأعطيه درجة منخفضة واذكري السبب. إن لم يكن المرفق متعلقًا بالمهمة فاذكري ذلك. اكتبي التغذية الراجعة للطالبة بصيغة المؤنث، مشجعة ومحددة. أعيدي JSON فقط:\n{"scores":[{"got":رقم,"why":"سبب قصير"}],"fb":"تغذية راجعة في سطرين","good":["نقطة قوة"],"next":["خطوة تحسين محددة"]}\nبنفس ترتيب البنود (${rubric.length} بنود).`;
  const images = await Promise.all(frames.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()).toString("base64"), type: "image/jpeg" as const })));
  let ev: any = null;
  try {
    const r = await askClaude({ prompt, images });
    const j: any = parseJson(r.text);
    const sc = rubric.map((q, i) => { const e = (j?.scores || [])[i] || {}; return { got: Math.max(0, Math.min(q.max, Math.round((+e.got || 0) * 2) / 2)), why: String(e.why || "") }; });
    ev = { scores: sc, total: sc.reduce((a, e) => a + e.got, 0), fb: String(j?.fb || ""), good: (j?.good || []).map(String).slice(0, 4), next: (j?.next || []).map(String).slice(0, 4), at: new Date().toISOString() };
    await admin.from("ai_jobs").insert({ student_id: c.sid, kind: "task-eval", input_tokens: r.usage?.input_tokens ?? null, output_tokens: r.usage?.output_tokens ?? null });
  } catch (e: any) {
    await admin.from("ai_jobs").insert({ student_id: c.sid, kind: "task-eval", status: e?.code || "error" });
  }
  const sub = meta.sub || {};
  const at = String(sub.at || new Date().toISOString());
  const { error } = await admin.from("task_submissions").insert({
    id: subIdOf(c.sid, task.test_id, at), task_id: task.id, student_id: c.sid, school_id: task.school_id, kind: ["img", "pdf", "vid"].includes(sub.kind) ? sub.kind : "img",
    storage_path: typeof sub.path === "string" && sub.path.includes(`/student/${c.sid}/`) ? sub.path : null,
    thumbs: (Array.isArray(sub.th) ? sub.th : []).filter((t: unknown) => typeof t === "string" && t.startsWith("data:image/jpeg") && t.length < 400000).slice(0, 4),
    name: String(sub.name || "").slice(0, 200), size: +sub.size || null, note, duration: Math.round(dur) || null, submitted_at: at,
  });
  if (error) return fail("server", 500);
  await admin.from("perf_tasks").update({ ai_eval: ev, teacher_grade: null }).eq("id", task.id);
  return json({ ev });
}

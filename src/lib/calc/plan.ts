/** Rule-based remedial/enrichment plan and the default performance task, as in the original app. */
import { fmt, studentStats } from "./core";
import type { Ctx, Level, Test } from "./types";

export function buildPlan(ctx: Ctx, sid: string, t: Test) {
  const x = studentStats(ctx, t, sid);
  if (!x) return null;
  const sk = (id: string) => ctx.skills.find((s) => s.id === id);
  const miss = x.missing, kind = miss.length ? "remedial" : "enrich", L: string[] = [];
  const how: Record<Level, string> = {
    K: "راجعي تعريفاته وأمثلته من الكتاب، ثم اكتبي ملخصًا من ثلاثة أسطر بكلماتك.",
    A: "حُلّي مثالين محلولين من الكتاب خطوة خطوة، ثم سؤالين مشابهين دون النظر إلى الحل.",
    R: "تدرّبي على قراءة الرسوم والجداول المرتبطة به، واشرحي لوليّ أمرك كيف وصلتِ إلى الإجابة.",
  };
  if (kind === "remedial") {
    L.push(`خطة علاجية – ${t.name}`, `الدرجة الحالية: ${fmt(x.score)} من ${fmt(x.total)}. المهارات التي تحتاج تدريبًا: ${miss.length}.`, "");
    miss.forEach((m, i) => {
      const k = sk(m.id);
      L.push(`${i + 1}) ${k?.name} (درس: ${k?.lesson || "—"})`, `   • ${(k && how[k.level]) || how.K}`, `   • حُلّي أسئلة هذه المهارة في اختبار التحسين المرسل إليك.`);
    });
    L.push("", "المدة المقترحة: أسبوع واحد، بمعدل 20 دقيقة يوميًا.", "دور وليّ الأمر: متابعة إنجاز المهمة اليومية، وتأكيد الاطلاع من هذه الصفحة.", "بعدها تؤدي الطالبة اختبار التحسين لتستعيد الدرجات المفقودة.");
  } else {
    const top = x.skills.filter((o) => sk(o.id)?.level === "R" || sk(o.id)?.level === "A").slice(0, 3).map((o) => sk(o.id)?.name);
    L.push(`خطة إثرائية – ${t.name}`, `أتقنتِ جميع مهارات الاختبار (${fmt(x.score)} من ${fmt(x.total)}). هذه مهام تتحدى مهاراتك العليا:`, "");
    L.push(
      "1) مهمة استدلال: اختاري ظاهرة من الدروس واكتبي لها فرضية وتوقعًا وطريقة اختبار.",
      `2) تعميق: ابحثي في مصدر موثوق عن تطبيق حياتي لإحدى هذه المهارات واكتبي فقرة عنه: ${top.join("؛ ") || "مهارات الفصل"}.`,
      "3) تعليم الأقران: اشرحي مهارة أتقنتِها لزميلة تحتاج دعمًا، بإشراف المعلمة.",
      "4) بناء أسئلة: اكتبي ثلاثة أسئلة جديدة بمستوى التطبيق أو الاستدلال وسلّميها للمعلمة لتُضاف إلى بنك الأسئلة.",
    );
    L.push("", "المدة المقترحة: أسبوعان. تُعرض أفضل الأعمال في الصف.");
  }
  return { kind: kind as "remedial" | "enrich", text: L.join("\n") };
}

export const TK_DEL = { any: "صورة أو PDF أو فيديو", img: "صورة", pdf: "ملف PDF", vid: "فيديو" } as const;
export type Deliver = keyof typeof TK_DEL;
export interface RubricRow { c: string; max: number; lv: string[] }

/** The default task the teacher starts from (before or instead of the AI suggestion). */
export function taskBase(ctx: Ctx, sid: string, t: Test) {
  const x = studentStats(ctx, t, sid);
  const miss = (x?.missing || []).map((o) => ctx.skills.find((s) => s.id === o.id)).filter((k): k is NonNullable<typeof k> => !!k);
  const lv = miss.reduce<Record<string, number>>((a, k) => ((a[k.level] = (a[k.level] || 0) + 1), a), {});
  const top = (Object.keys(lv).sort((a, b) => lv[b] - lv[a])[0] || "A") as Level;
  const kind = ({ K: ["ملصق علمي أو خريطة مفاهيم", "img"], A: ["نموذج أو تجربة منزلية مصوّرة بخطواتها", "any"], R: ["فيديو قصير تشرحين فيه وتبرّرين", "vid"] } as const)[top];
  return {
    skills: miss.map((k) => k.id),
    title: `مهمة أدائية: ${kind[0]}`,
    del: kind[1] as Deliver,
    desc: `صمّمي ${kind[0]} يوضّح المهارات الآتية بأمثلة من حياتك اليومية:\n${miss.map((k) => "• " + k.name).join("\n")}\nاكتبي تحت عملك ثلاثة أسطر تشرحين فيها ما تعلّمتِه.`,
    rubric: [
      { c: "الدقة العلمية للمفاهيم", max: 4 },
      { c: "توظيف المهارة المطلوبة في المهمة", max: 4 },
      { c: "التفسير والتبرير بلغتك", max: 4 },
      { c: "التنظيم والإخراج والوضوح", max: 3 },
    ].map((r) => ({ ...r, lv: ["أداء متقن كامل ودقيق", "أداء جيد مع أخطاء بسيطة", "أداء يحتاج إلى تحسين"] })) as RubricRow[],
  };
}

export const tkMax = (task: { rubric: RubricRow[] }) => task.rubric.reduce((a, r) => a + r.max, 0);
export const rubricText = (rb: RubricRow[]) => rb.map((r) => [r.c, r.max, ...(r.lv || [])].join(" | ")).join("\n");
export const parseRubric = (s: string): RubricRow[] =>
  s.split("\n").map((l) => l.split("|").map((v) => v.trim())).filter((p) => p[0])
    .map(([c, m, ...lv]) => ({ c, max: Math.max(1, Math.min(20, +m || 4)), lv: lv.filter(Boolean) }));

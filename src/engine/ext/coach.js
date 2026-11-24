/* ===== Teacher's AI assistant (added in the new platform) =====
 * Suggestions grounded in this class's own figures: re-teaching the weakest skills, changing the strategy for skills
 * that stayed unmastered after improvement, misconceptions read from the wrong options students chose,
 * differentiated groups, and a full remedial lesson. Only skills, percentages, counts and question texts are sent:
 * never a student's name (groups are filled with names on this device). */
Object.assign(EN, { "مساعد المعلمة بالذكاء الاصطناعي": "Teacher's AI assistant" });
const COACH_CTX = () => `أنتِ مشرفة تربوية خبيرة في تدريس العلوم للمرحلة المتوسطة في السعودية، وتعرفين إطار تيمز للمستويات المعرفية (المعرفة، التطبيق، الاستدلال) واستراتيجيات التعلم النشط. المادة: ${S.settings.subject || "العلوم"}، الصف: ${S.settings.grade || "الثالث المتوسط"}. اكتبي بالعربية لمعلمة، بعبارات عملية قابلة للتنفيذ في الفصل دون أجهزة للطالبات، ونص عادي بلا رموز تنسيق (بلا نجوم ولا علامات #)، مع ترقيم واضح.`;
const coachScope = () => (S.ui.cls ? `فصل ${S.ui.cls}` : "كل الفصول");
const skillLine = (x) => { const k = sk(x.id) || {}; return `- ${k.name} (درس: ${k.lesson || "—"}، المستوى: ${LEVELS[k.level] || ""})، الإتقان ${x.pct}%${x.pct0 !== x.pct ? ` (كان ${x.pct0}% قبل التحسين)` : ""}، ${x.low} طالبة دون 50%`; };
const qsOf = (t, id) => t.qs.filter((q) => q.skill === id).map((q) => "  • " + q.text + (q.opts && q.opts.length ? ` [الخيارات: ${q.opts.map((o, i) => LETTERS[i] + ") " + o).join("، ")}]` : "")).join("\n");
function coachOpen(title, sub, prompt, extra) {
  modal(`<h3>${title}</h3><p class="muted">${sub}</p>${extra || ""}<textarea id="aiText" rows="18" readonly></textarea><div class="row end"><button class="btn ghost sm" data-act="coachCopy">نسخ النص</button></div><p class="muted">${aiCopy}</p>`, true);
  aiWrite(COACH_CTX() + "\n\n" + prompt);
}
A.coachCopy = async () => { const t = $("#aiText"); if (!t) return; try { await navigator.clipboard.writeText(t.value); toast("نُسخ النص."); } catch (e) { t.focus(); t.select(); toast("حُدّد النص؛ انسخيه يدويًا."); } };

function coachCard(t, g) {
  if (!Store.sample || !g.skills.length) return "";
  const stillN = impsOf(t.id).some((m) => Object.keys(m.results || {}).length) ? g.skills.filter((x) => x.pct < 80 && x.pct0 < 80).length : 0;
  const hasAns = !!(t.answers && Object.keys(t.answers).length);
  return `<section class="card coach"><h2>${IC.ai} مساعد المعلمة بالذكاء الاصطناعي <small class="muted">${coachScope()} · ${esc(t.name)}</small></h2>
    <p class="muted">اقتراحات مبنية على نتائج طالباتك الفعلية في هذا الاختبار. لا يُرسل أي اسم طالبة، فقط المهارات والنسب والأعداد ونصوص الأسئلة.</p>
    <div class="coachgrid">
      <button class="btn ghost" data-act="coachReteach">خطة إعادة شرح للمهارات الأضعف</button>
      <button class="btn ghost" data-act="coachStrategy" ${stillN ? "" : "disabled title=\"يظهر بعد تصحيح اختبار تحسين\""}>تغيير الاستراتيجية للمهارات التي لم تتحسن${stillN ? ` (${stillN})` : ""}</button>
      <button class="btn ghost" data-act="coachMisconceptions" ${hasAns ? "" : "disabled title=\"يحتاج الإجابات المختارة: صحّحي بملف إكسل أو بالتصوير\""}>المفاهيم الخاطئة من بدائل الإجابة</button>
      <button class="btn ghost" data-act="coachGroups">مجموعات تعلم متمايزة</button>
      <span class="row"><select id="coachSkill" aria-label="المهارة">${g.skills.map((x) => opt(x.id, `${(sk(x.id) || {}).name || ""} (${x.pct}%)`, g.skills[0].id)).join("")}</select><button class="btn ghost" data-act="coachLesson">خطة حصة علاجية</button></span>
    </div>
    ${hasAns ? "" : `<p class="muted small">«المفاهيم الخاطئة» تعمل عند التصحيح بملف إكسل أو بالتصوير، حيث تُحفظ الإجابة التي اختارتها كل طالبة.</p>`}</section>`;
}
const coachData = () => { const t = curTest(); return { t, g: groupStats(t, S.ui.cls || "") }; };

A.coachReteach = () => {
  const { t, g } = coachData(), weak = g.skills.slice(0, 3), lv = Object.entries(g.levels).filter(([, v]) => v.t).map(([L, v]) => `${LEVELS[L]} ${pct(v.c, v.t)}%`).join("، ");
  coachOpen("خطة إعادة شرح للمهارات الأضعف", `${coachScope()} · ${g.n} طالبة · ${weak.length} مهارات`,
    `هذه نتائج ${g.n} طالبة (${coachScope()}) في ${t.name}. الإتقان حسب المستوى المعرفي: ${lv}.\nأضعف المهارات:\n${weak.map((x) => skillLine(x) + "\n  أسئلة الاختبار التي قاستها:\n" + qsOf(t, x.id)).join("\n")}\n\nلكل مهارة اكتبي:\n1) سببين محتملين لتعثر الطالبات فيها (مفهوم خاطئ شائع أو صعوبة في المستوى المعرفي).\n2) استراتيجية إعادة شرح مختلفة عن الشرح التقليدي، مناسبة لمستواها المعرفي (مثلًا: نمذجة، تجربة عملية بسيطة، تمثيل بصري، تعلم بالأقران)، بخطوات تنفيذ في 15 دقيقة.\n3) نشاط تقويم تكويني سريع (3 دقائق) للتأكد من الفهم أثناء الشرح.\n4) سؤال تذكرة خروج واحد بمستوى المهارة نفسه.\nثم اختمي بترتيب مقترح: أي المهارات تبدئين بها ولماذا، وكم حصة تحتاج.`);
};
A.coachStrategy = () => {
  const { t, g } = coachData(), rounds = impsOf(t.id).filter((m) => Object.keys(m.results || {}).length).length;
  const still = g.skills.filter((x) => x.pct < 80 && x.pct0 < 80).slice(0, 4);
  coachOpen("تغيير الاستراتيجية للمهارات التي لم تتحسن", `${coachScope()} · بعد ${rounds} ${rounds === 1 ? "اختبار تحسين" : "اختبارات تحسين"}`,
    `بعد شرح هذه المهارات ثم ${rounds} ${rounds === 1 ? "اختبار تحسين فردي" : "اختبارات تحسين فردية"} لكل طالبة في مهاراتها المفقودة، ما زالت المهارات الآتية دون 80% (${coachScope()}، ${g.n} طالبة):\n${still.map((x) => skillLine(x) + "\n  أسئلة قاستها:\n" + qsOf(t, x.id)).join("\n")}\n\nالمطلوب: الطريقة المعتادة في الشرح والتدريب الفردي لم تكفِ، فاقترحي تغييرًا حقيقيًا في الاستراتيجية لا مجرد تكرار. لكل مهارة:\n1) تشخيص: ما الذي يرجّح أن الطالبات لم يفهمنه (المفهوم المسبق الخاطئ أو الخطوة المفقودة).\n2) استراتيجية بديلة مختلفة جذريًا عن الشرح المباشر، واذكري اسمها (مثل: دورة التعلم الخماسية، التعلم بالاستقصاء، الخرائط المفاهيمية، التعلم التعاوني بالأدوار، المحاكاة بالمواد المحسوسة، التدريس التبادلي)، ولماذا تناسب هذه المهارة تحديدًا.\n3) خطوات تنفيذها في حصة واحدة.\n4) كيف تعرف المعلمة أنها نجحت هذه المرة (دليل إتقان محدد).\nواختمي بتوصية: هل الأفضل إعادة الشرح للفصل كله، أم لمجموعة صغيرة، أم بمهمة أدائية.`);
};
A.coachMisconceptions = () => {
  const { t } = coachData(), sids = sortedStudents(S.ui.cls || "").filter((s) => t.results[s.id]).map((s) => s.id), dx = distractors(t, sids);
  const rows = dx.map((d, i) => (d ? { d, q: t.qs[i], i } : null)).filter(Boolean).map(({ d, q, i }) => { const wrong = d.opts.filter((o) => !o.key && o.n).sort((a, b) => b.n - a.n)[0]; return wrong ? { q, i, wrong, d } : null; }).filter(Boolean)
    .sort((a, b) => b.wrong.n / b.d.seen - a.wrong.n / a.d.seen).slice(0, 5);
  if (!rows.length) return toast("لا توجد بدائل خاطئة مختارة بما يكفي للتحليل.", true);
  const lab = (q, k) => (q.type === "tf" ? ["صح", "خطأ"][k] : LETTERS[k]);
  coachOpen("المفاهيم الخاطئة من بدائل الإجابة", `${coachScope()} · أكثر ${rows.length} أسئلة جذب فيها بديل خاطئ الطالبات`,
    `هذه أسئلة من ${t.name} جذب فيها بديل خاطئ عددًا كبيرًا من الطالبات (${coachScope()}):\n${rows.map(({ q, i, wrong, d }) => `السؤال ${i + 1}: ${q.text}\n${q.type === "tf" ? "صح أو خطأ" : (q.opts || []).map((o, k) => `${lab(q, k)}) ${o}`).join("  ")}\nالإجابة الصحيحة: ${lab(q, q.ans || 0)}. البديل الخاطئ الأكثر اختيارًا: ${lab(q, wrong.k)} اختارته ${wrong.n} من ${d.seen} طالبة${wrong.flag === "lure" ? " (واختارته المتفوقات أكثر من غيرهن)" : ""}.\nالمهارة: ${(sk(q.skill) || {}).name || ""}`).join("\n\n")}\n\nلكل سؤال:\n1) ما المفهوم الخاطئ (أو الخلط) الذي يرجّح أنه دفع الطالبات لاختيار هذا البديل.\n2) كيف تكشفه المعلمة في الحصة بسؤال أو موقف قصير.\n3) نشاط يصحح المفهوم (تجربة، مثال مضاد، مقارنة).\n4) إن كان البديل جذب المتفوقات فهل في صياغة السؤال غموض؟ واقترحي صياغة أوضح.`);
};
A.coachGroups = () => {
  const { t, g } = coachData(), id = $("#coachSkill") ? $("#coachSkill").value : g.skills[0].id, k = sk(id) || {};
  const band3 = { a: [], b: [], c: [] };
  g.students.forEach((x) => { const o = x.skills.find((z) => z.id === id); if (!o) return; (o.pct < 50 ? band3.a : o.pct < 80 ? band3.b : band3.c).push(x.sid); });
  const names = (l) => l.map((sid) => { const s = stu(sid); return s ? `<span>${nm(s)} <small class="muted">${esc(s.cls)}</small></span>` : ""; }).join("، ") || "—";
  const extra = `<div class="dgrid"><div><h4 class="lo">مجموعة الدعم المكثف (${band3.a.length})</h4><p class="small">${names(band3.a)}</p></div><div><h4>مجموعة الدعم (${band3.b.length})</h4><p class="small">${names(band3.b)}</p></div><div><h4 class="hi">مجموعة الإثراء والقيادة (${band3.c.length})</h4><p class="small">${names(band3.c)}</p></div></div>`;
  coachOpen("مجموعات تعلم متمايزة", `${esc(k.name || "")} · ${coachScope()}`,
    `أريد تنظيم حصة بمجموعات متمايزة في مهارة: ${k.name} (درس: ${k.lesson || "—"}، المستوى: ${LEVELS[k.level] || ""}).\nتوزيع الطالبات (${coachScope()}):\n- مجموعة الدعم المكثف (إتقان أقل من 50%): ${band3.a.length} طالبة\n- مجموعة الدعم (50% إلى 79%): ${band3.b.length} طالبة\n- مجموعة الإثراء (80% فأكثر): ${band3.c.length} طالبة\nأسئلة الاختبار التي قاست المهارة:\n${qsOf(t, id)}\n\nاقترحي خطة حصة واحدة (45 دقيقة) تعمل فيها المجموعات الثلاث في الوقت نفسه:\n1) مهمة لكل مجموعة تناسب مستواها (المواد، الخطوات، المنتج المتوقع).\n2) دور المعلمة: مع أي مجموعة تجلس ومتى.\n3) كيف تستفيد مجموعة الإثراء في دعم الأخريات (قائدات مجموعات أو تعليم أقران) دون أن تتوقف عن التقدم.\n4) دليل إتقان تجمعه المعلمة من كل مجموعة في نهاية الحصة.\nإن كانت إحدى المجموعات فارغة فاقترحي بديلًا مناسبًا.`, extra);
};
A.coachLesson = () => {
  const { t, g } = coachData(), id = $("#coachSkill") ? $("#coachSkill").value : g.skills[0].id, x = g.skills.find((z) => z.id === id), k = sk(id) || {};
  coachOpen("خطة حصة علاجية", `${esc(k.name || "")} · الإتقان ${x ? x.pct : "—"}%`,
    `صمّمي خطة حصة علاجية كاملة (45 دقيقة) لإعادة تعليم مهارة:\n${x ? skillLine(x) : k.name}\nأسئلة الاختبار التي قاستها:\n${qsOf(t, id)}\n\nبالترتيب:\n1) هدف الحصة بصيغة سلوكية قابلة للقياس.\n2) التهيئة (5 دقائق): سؤال أو موقف يكشف المفهوم المسبق.\n3) العرض بأسلوب مختلف عن الشرح الأول (15 دقيقة) مع الخطوات.\n4) التطبيق الموجّه في أزواج (10 دقائق) مع مثال محلول ومثال للتدريب.\n5) التطبيق المستقل (10 دقائق): ثلاثة أسئلة متدرجة بمستوى المهارة (معرفة ثم تطبيق ثم استدلال) مع إجاباتها النموذجية.\n6) الختام وتذكرة الخروج (5 دقائق).\n7) الوسائل المطلوبة (بسيطة ومتاحة في المدرسة).\n8) واجب منزلي قصير اختياري، وكيف يتابعه وليّ الأمر.`);
};
{ const st = document.createElement("style"); st.textContent = `.coachgrid{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.coachgrid .row{gap:6px;flex-wrap:wrap}.coachgrid select{max-width:280px}.coach h2 svg{vertical-align:-2px}`; document.head.appendChild(st); }

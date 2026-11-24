/* ===== Performance tasks until mastery (added in the new platform) =====
 * A task with its own rubric for a group of the class, for every student who has not mastered chosen skills,
 * or for students the teacher picks. Each student hands in her work (image, PDF or video); the AI gives a
 * per-criterion first reading; the teacher decides "mastered" or "try again", and the student resubmits
 * until she masters the skill. State: S.tasks[setId] = {..., students: {sid: {status, tg, tnote, ev, subs}}}. */
NAV.splice(NAV.findIndex((n) => n[0] === "improve") + 1, 0, ["tasks", "المهام الأدائية"]);
Object.assign(EN, { "المهام الأدائية": "Performance tasks", "مهمة أدائية جديدة": "New performance task", "مهامي الأدائية": "My performance tasks", "أتقنت المهارة": "Skill mastered", "تحتاج محاولة أخرى": "Try again" });
S.tasks = S.tasks || {};
const TS_STATUS = {
  assigned: ["", "لم تُسلَّم بعد"], submitted: ["mid", "بانتظار مراجعة المعلمة"], retry: ["low", "تحتاج محاولة أخرى"], mastered: ["high", "أتقنت المهارة"],
};
const TS_ORDER = { submitted: 0, retry: 1, assigned: 2, mastered: 3 };
const tsPill = (st) => { const [c, l] = TS_STATUS[st] || TS_STATUS.assigned; return `<span class="pill ${c}">${l}</span>`; };
const tsList = () => Object.values(S.tasks || {}).sort((a, b) => String(b.at).localeCompare(String(a.at)));
const tsTarget = (T) => { const g = T.target || {}; return g.kind === "group" ? `المجموعة ${(+g.group || 0) + 1} · فصل ${esc(g.cls || "")}` : g.kind === "skill" ? `من لم تتقن المهارة${g.cls ? " · فصل " + esc(g.cls) : ""}` : `طالبات محددات`; };
const tsSkills = (T) => (T.skills || []).map((id) => `<span class="chip">${esc((sk(id) || {}).name || "")}</span>`).join(" ");
const tsLast = (st) => (st && st.subs && st.subs.length ? st.subs[st.subs.length - 1] : null);

/* ---------- teacher: the tasks page ---------- */
function vTasksM() {
  const list = tsList();
  return `<section class="card"><div class="hd"><h2>المهام الأدائية حتى الإتقان</h2><button class="btn" data-act="tsNew">${IC.plus} مهمة أدائية جديدة</button></div>
    <p class="muted">مهمة بسلّم تقدير لمجموعة من الفصل، أو لكل من لم تتقن مهارة، أو لطالبات تختارينهن. تسلّم كل طالبة عملها (صورة أو PDF أو فيديو)، فيقيّمه الذكاء الاصطناعي تقييمًا أوليًا لكل بند، ثم تقرّرين: «أتقنت المهارة» أو «تحتاج محاولة أخرى». تعيد الطالبة التسليم حتى تتقن.</p></section>
  ${list.length ? list.map(tsCard).join("") : `<section class="card"><p class="muted">لا توجد مهام بعد. اضغطي «مهمة أدائية جديدة».</p></section>`}`;
}
function tsCard(T) {
  const ids = Object.keys(T.students || {}), by = (k) => ids.filter((id) => (T.students[id].status || "assigned") === k).length, max = tkMax(T);
  const rows = ids.map((id) => ({ id, s: stu(id), st: T.students[id] })).filter((r) => r.s).sort((a, b) => (TS_ORDER[a.st.status] ?? 2) - (TS_ORDER[b.st.status] ?? 2) || String(a.s.cls).localeCompare(String(b.s.cls)) || a.s.no - b.s.no);
  const done = by("mastered");
  return `<section class="card"><div class="hd"><h2>${esc(T.title)} <small class="muted">${tsTarget(T)} · محك الإتقان ${T.mastery}% (${fmt((max * T.mastery) / 100)} من ${fmt(max)})${T.due ? " · آخر موعد " + esc(T.due) : ""}</small></h2>
    <div class="row"><button class="lnk" data-act="tsEdit" data-id="${esc(T.id)}">تعديل</button><button class="lnk danger" data-act="tsDel" data-id="${esc(T.id)}">حذف</button></div></div>
    <p>${tsSkills(T)}</p>
    <div class="grid4"><div class="tile"><b>${done} / ${ids.length}</b><span>أتقنّ المهارة</span></div><div class="tile"><b>${by("submitted")}</b><span>بانتظار مراجعتك</span></div><div class="tile"><b>${by("retry")}</b><span>تحتاج محاولة أخرى</span></div><div class="tile"><b>${by("assigned")}</b><span>لم تُسلَّم بعد</span></div></div>
    <span class="bar" style="margin:8px 0"><i class="high" style="width:${Math.max(2, pct(done, ids.length))}%"></i></span>
    <div class="scroll"><table class="tbl"><thead><tr><th>الطالبة</th><th>الفصل</th><th>الحالة</th><th>المحاولات</th><th>آخر تقييم</th><th></th></tr></thead><tbody>${rows.map((r) => {
      const ev = r.st.ev, g = r.st.status === "mastered" && r.st.tg != null ? r.st.tg : ev ? ev.total : null;
      return `<tr><td>${nm(r.s)}</td><td>${esc(r.s.cls)}</td><td>${tsPill(r.st.status)}</td><td class="num">${(r.st.subs || []).length}</td><td class="num">${g == null ? "—" : `${fmt(g)} / ${fmt(max)}`}</td><td>${(r.st.subs || []).length ? `<button class="btn sm ${r.st.status === "submitted" ? "" : "ghost"}" data-act="tsReview" data-id="${esc(T.id)}" data-s="${r.id}">مراجعة العمل</button>` : ""}</td></tr>`;
    }).join("")}</tbody></table></div></section>`;
}

/* ---------- teacher: creating or editing a task ---------- */
let TSD = null; // draft
function tsDefault(skillIds) {
  const ks = skillIds.map(sk).filter(Boolean), lv = ks.reduce((a, k) => ((a[k.level] = (a[k.level] || 0) + 1), a), {}), top = Object.keys(lv).sort((a, b) => lv[b] - lv[a])[0] || "A";
  const kind = { K: ["ملصق علمي أو خريطة مفاهيم", "img"], A: ["نموذج أو تجربة منزلية مصوّرة بخطواتها", "any"], R: ["فيديو قصير تشرحين فيه وتبرّرين", "vid"] }[top];
  return { title: `مهمة أدائية: ${kind[0]}`, del: kind[1], desc: `صمّمي ${kind[0]} يوضّح المهارات الآتية بأمثلة من حياتك اليومية:\n${ks.map((k) => "• " + k.name).join("\n")}\nاكتبي تحت عملك ثلاثة أسطر تشرحين فيها ما تعلّمتِه.`,
    rubric: [{ c: "الدقة العلمية للمفاهيم", max: 4 }, { c: "توظيف المهارة المطلوبة", max: 4 }, { c: "التفسير والتبرير", max: 4 }, { c: "التنظيم والوضوح", max: 3 }].map((r) => ({ ...r, lv: ["أداء متقن كامل ودقيق", "أداء جيد مع أخطاء بسيطة", "أداء يحتاج إلى تحسين"] })) };
}
function tsWeakSkills(cls) { // skills of the current test, weakest first, with how many students are below the criterion
  const t = curTest(); if (!t || !Object.keys(t.results || {}).length) return [];
  const g = groupStats(t, cls || "");
  return g.skills.map((x) => ({ id: x.id, pct: x.pct, below: g.students.filter((s) => (s.skills.find((o) => o.id === x.id) || {}).pct < (TSD ? TSD.mastery : 80)).length }));
}
function tsResolve() { // which students the draft targets
  const d = TSD, cls = d.cls || "";
  if (d.kind === "group") { const G = groupsOf(cls); return G ? sortedStudents(cls).filter((s) => (G.of || {})[s.id] === +d.group).map((s) => s.id) : []; }
  if (d.kind === "skill") {
    const t = curTest(); if (!t || !d.skills.length) return [];
    return sortedStudents(cls).filter((s) => { const x = studentStats(t, s.id); return x && d.skills.some((id) => { const o = x.skills.find((z) => z.id === id); return o && o.pct < d.mastery; }); }).map((s) => s.id);
  }
  return d.picked.slice();
}
function tsForm() {
  const d = TSD, cls = d.cls || "", G = groupsOf(cls), weak = tsWeakSkills(cls), weakIds = new Set(weak.map((w) => w.id));
  const skillRows = [...weak.map((w) => ({ id: w.id, note: `إتقان ${w.pct}% · ${w.below} طالبة دون المحك` })), ...(d.allSkills ? S.skills.filter((k) => !weakIds.has(k.id)).map((k) => ({ id: k.id, note: "" })) : [])];
  const who = tsResolve();
  return `<h3>${d.editing ? "تعديل المهمة الأدائية" : "مهمة أدائية جديدة"}</h3>
  <div class="row wrap"><label class="fld sm">لمن المهمة؟<select data-chg="tsField" data-k="kind">${opt("skill", "كل من لم تتقن المهارات المختارة", d.kind)}${opt("group", "مجموعة من مجموعات الفصل", d.kind)}${opt("picked", "طالبات أختارهن", d.kind)}</select></label>
    <label class="fld sm">الفصل<select data-chg="tsField" data-k="cls">${opt("", "كل الفصول", cls)}${classes().map((c) => opt(c, "فصل " + c, cls)).join("")}</select></label>
    ${d.kind === "group" ? (G ? `<label class="fld sm">المجموعة<select data-chg="tsField" data-k="group">${Array.from({ length: G.n }, (_, i) => opt(String(i), "المجموعة " + (i + 1), String(d.group))).join("")}</select></label>` : `<p class="note warn">لا توجد مجموعات لهذا الفصل. أنشئيها من «الحصة الآن» ← تقييم المجموعات.</p>`) : ""}
    <label class="fld sm">محك الإتقان %<input type="number" min="50" max="100" value="${d.mastery}" data-chg="tsField" data-k="mastery"></label></div>
  <fieldset class="chips"><legend>المهارات التي تقيسها المهمة (الأضعف أولًا)</legend>${skillRows.map((r) => { const k = sk(r.id) || {}; return `<label><input type="checkbox" data-chg="tsSkill" value="${esc(r.id)}" ${d.skills.includes(r.id) ? "checked" : ""}>${esc(k.name || "")} <small class="muted">${LEVELS[k.level] || ""}${r.note ? " · " + r.note : ""}</small></label>`; }).join("")}
    ${d.allSkills ? "" : `<button type="button" class="lnk" data-act="tsAllSkills">عرض كل المهارات</button>`}</fieldset>
  ${d.kind === "picked" ? `<details class="sheet" open><summary>اختيار الطالبات (${d.picked.length})</summary><div class="stupick">${sortedStudents(cls).map((s) => `<label class="chk"><input type="checkbox" data-chg="tsPick" value="${s.id}" ${d.picked.includes(s.id) ? "checked" : ""}> ${nm(s)} <small class="muted">${esc(s.cls)}</small></label>`).join("")}</div></details>` : ""}
  <p class="note ${who.length ? "ok" : "warn"}" id="tsWho">${who.length ? `ستُرسل المهمة إلى <b>${who.length}</b> طالبة.` : "لا توجد طالبة مطابقة بعد. اختاري المهارات أو المجموعة أو الطالبات."}</p>
  <div id="tsBusy"></div>
  <label class="fld">عنوان المهمة<input id="tsTitle" value="${esc(d.title)}" data-keep></label>
  <label class="fld">وصف المهمة وخطواتها<textarea id="tsDesc" rows="6" data-keep>${esc(d.desc)}</textarea></label>
  <div class="row wrap"><label class="fld sm">ما تُسلّمه الطالبة<select id="tsDel">${Object.entries(TK_DEL).map(([k, v]) => opt(k, v, d.del)).join("")}</select></label><label class="fld sm">آخر موعد<input id="tsDue" type="date" value="${esc(d.due || "")}"></label></div>
  <label class="fld">بنود التقييم: سطر لكل بند «البند | الدرجة | وصف المتقن | وصف الجيد | وصف يحتاج تحسين»<textarea id="tsRub" rows="6" data-keep>${esc(rubricText(d.rubric))}</textarea></label>
  <div class="row end">${Store.sample ? `<button class="btn ghost" data-act="tsAI">${IC.ai} اقتراح المهمة وبنودها بالذكاء الاصطناعي</button>` : ""}<button class="btn ghost" data-act="close">إلغاء</button><button class="btn" data-act="tsSave">${d.editing ? "حفظ التعديل" : "إرسال المهمة"}</button></div>`;
}
const tsKeep = () => { if (!$("#tsTitle")) return; TSD.title = $("#tsTitle").value; TSD.desc = $("#tsDesc").value; TSD.del = $("#tsDel").value; TSD.due = $("#tsDue").value; TSD.rubric = parseRubric($("#tsRub").value); };
const tsRedraw = () => { tsKeep(); modal(tsForm(), true); };
A.tsNew = () => { const d0 = tsDefault([]); TSD = { kind: "skill", cls: S.ui.cls || "", group: 0, mastery: 80, skills: [], picked: [], allSkills: false, ...d0 }; modal(tsForm(), true); };
A.tsEdit = (el) => { const T = S.tasks[el.dataset.id]; TSD = { editing: T.id, kind: (T.target || {}).kind || "picked", cls: (T.target || {}).cls || "", group: (T.target || {}).group || 0, mastery: T.mastery, skills: (T.skills || []).slice(), picked: Object.keys(T.students), allSkills: true, title: T.title, desc: T.desc, del: T.del, due: T.due, rubric: T.rubric }; if (TSD.kind !== "picked") TSD.kind = "picked"; modal(tsForm(), true); };
A.tsAllSkills = () => { TSD.allSkills = true; tsRedraw(); };
Object.assign(C, {
  tsField: (el) => { const k = el.dataset.k; const before = k === "kind" ? tsResolveSafe() : null; TSD[k] = k === "mastery" ? Math.max(50, Math.min(100, +el.value || 80)) : el.value; if (k === "kind" && TSD.kind === "picked" && !TSD.picked.length && before) TSD.picked = before; tsRedraw(); },
  tsSkill: (el) => { TSD.skills = el.checked ? [...new Set([...TSD.skills, el.value])] : TSD.skills.filter((x) => x !== el.value); if (!TSD.editing && !TSD.aiUsed) { const d0 = tsDefault(TSD.skills); TSD.title = d0.title; TSD.desc = d0.desc; TSD.del = d0.del; $("#tsTitle").value = d0.title; $("#tsDesc").value = d0.desc; $("#tsDel").value = d0.del; } const w = $("#tsWho"), n = tsResolve().length; if (w) { w.className = "note " + (n ? "ok" : "warn"); w.innerHTML = n ? `ستُرسل المهمة إلى <b>${n}</b> طالبة.` : "لا توجد طالبة مطابقة بعد."; } },
  tsPick: (el) => { TSD.picked = el.checked ? [...new Set([...TSD.picked, el.value])] : TSD.picked.filter((x) => x !== el.value); const w = $("#tsWho"); if (w) w.innerHTML = `ستُرسل المهمة إلى <b>${TSD.picked.length}</b> طالبة.`; },
});
function tsResolveSafe() { try { return tsResolve(); } catch (e) { return []; } }
A.tsAI = (el) => guard(async () => {
  tsKeep(); if (!TSD.skills.length) throw { message: "اختاري مهارة واحدة على الأقل." };
  const b = $("#tsBusy"); if (b) b.innerHTML = `<p class="note">${IC.ai} يقترح الذكاء الاصطناعي مهمة مناسبة… راجعيها وعدّليها قبل الإرسال.</p>`; el.disabled = true;
  try {
    const list = TSD.skills.map((id) => { const k = sk(id) || {}; return `- ${k.name} (المستوى: ${LEVELS[k.level] || ""})`; }).join("\n");
    const forWhom = TSD.kind === "group" ? "مجموعة من طالبات الفصل يعملن معًا" : "طالبة واحدة أو أكثر، كل منهن تعمل وحدها";
    const r = await Store.sample.json(`أنتِ معلمة علوم خبيرة في التقويم الأدائي للصف الثالث المتوسط في السعودية. صمّمي مهمة أدائية واحدة قصيرة (تُنجز خلال أسبوع بأدوات بسيطة) موجّهة إلى ${forWhom}، لم يتقنّ بعد المهارات الآتية:\n${list}\nالهدف أن تُتقن الطالبة المهارة، وتعيد المحاولة حتى تبلغ ${TSD.mastery}% من الدرجة. المهمة أصيلة ومرتبطة بالحياة اليومية، وتقيس المهارات نفسها في مستواها المعرفي (تيمز: المعرفة، التطبيق، الاستدلال)، ويمكن تسليمها صورة أو ملف PDF أو فيديو. اكتبي بلغة موجهة للطالبة بصيغة المؤنث. أعيدي JSON فقط بالشكل:\n{"title":"عنوان قصير","desc":"وصف المهمة وخطوات تنفيذها في 4–6 أسطر","del":"img|pdf|vid|any","rubric":[{"c":"بند التقييم","max":4,"lv":["وصف الأداء المتقن","وصف الأداء الجيد","وصف الأداء الذي يحتاج تحسينًا"]}]}\nاجعلي بنود التقييم 3–5 بنود، مجموع درجاتها 15، وأحدها مرتبط مباشرة بكل مهارة.`, { modelTier: "default" });
    if (!r || !r.title || !Array.isArray(r.rubric)) throw { message: "تعذّر اقتراح المهمة، جرّبي مرة أخرى." };
    TSD.aiUsed = true; TSD.title = String(r.title); TSD.desc = String(r.desc || ""); TSD.del = TK_DEL[r.del] ? r.del : "any";
    TSD.rubric = r.rubric.map((q) => ({ c: String(q.c || ""), max: Math.max(1, Math.min(20, +q.max || 3)), lv: (q.lv || []).map(String).slice(0, 3) })).filter((q) => q.c);
    modal(tsForm(), true); const b2 = $("#tsBusy"); if (b2) b2.innerHTML = `<p class="note ok">مهمة مقترحة بالذكاء الاصطناعي. راجعيها وعدّلي ما تشائين ثم أرسليها.</p>`;
  } finally { el.disabled = false; }
});
A.tsSave = () => guard(async () => {
  tsKeep(); const d = TSD, rb = d.rubric, ids = tsResolve();
  if (!d.title.trim() || !rb.length) throw { message: "اكتبي عنوان المهمة وبند تقييم واحدًا على الأقل." };
  if (!d.skills.length) throw { message: "اختاري المهارة التي تقيسها المهمة." };
  if (!ids.length) throw { message: "لا توجد طالبة تُرسل إليها المهمة." };
  const old = d.editing ? S.tasks[d.editing] : null, id = old ? old.id : uid("ts");
  const students = {}; ids.forEach((sid) => (students[sid] = (old && old.students[sid]) || { status: "assigned", tg: null, tnote: "", ev: null, subs: [] }));
  const T = { id, title: d.title.trim(), desc: d.desc.trim(), del: d.del, due: d.due || "", rubric: rb, skills: d.skills.slice(), mastery: d.mastery, target: { kind: d.kind, cls: d.cls || "", group: +d.group || 0 }, at: (old && old.at) || new Date().toISOString(), students };
  await Store.set("tasks/" + id, T); S.tasks[id] = T; A.close(); if (route() !== "tasks") location.hash = "tasks"; render();
}, "أُرسلت المهمة الأدائية إلى صفحات الطالبات.");
A.tsDel = (el) => modal(`<h3>حذف المهمة الأدائية</h3><p>ستُحذف المهمة وأعمال الطالبات المسلّمة فيها.</p><div class="row end"><button class="btn ghost" data-act="close">تراجع</button><button class="btn danger" data-act="tsDelYes" data-id="${esc(el.dataset.id)}">حذف</button></div>`);
A.tsDelYes = (el) => guard(async () => { await Store.del("tasks/" + el.dataset.id); delete S.tasks[el.dataset.id]; A.close(); render(); }, "حُذفت المهمة.");

/* ---------- teacher: reviewing one student's work ---------- */
function tsRubricTable(T, ev, finalMark) {
  return `<div class="scroll"><table class="tbl rub"><thead><tr><th>بند التقييم</th><th>متقن</th><th>جيد</th><th>يحتاج تحسينًا</th><th class="num">الدرجة</th></tr></thead><tbody>${T.rubric.map((r, i) => { const e = ev && ev.scores && ev.scores[i]; return `<tr><td><b>${esc(r.c)}</b>${e && e.why ? `<small class="muted d">${esc(e.why)}</small>` : ""}</td>${[0, 1, 2].map((k) => `<td class="small">${esc((r.lv || [])[k] || "")}</td>`).join("")}<td class="num">${e ? `<b>${fmt(e.got)}</b> / ` : ""}${r.max}</td></tr>`; }).join("")}</tbody>
    ${ev || finalMark != null ? `<tfoot><tr><td colspan="4">${finalMark != null ? "الدرجة المعتمدة من المعلمة" : "المجموع (تقييم أولي بالذكاء الاصطناعي)"}</td><td class="num"><b>${fmt(finalMark != null ? finalMark : ev.total)}</b> / ${tkMax(T)}</td></tr></tfoot>` : ""}</table></div>`;
}
const tsFeedback = (ev) => (!ev ? "" : `<div class="tkev"><p><b>التغذية الراجعة:</b> ${esc(ev.fb || "")}</p>${(ev.good || []).length ? `<p><b>ما أحسنتِ فيه:</b></p><ul>${ev.good.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : ""}${(ev.next || []).length ? `<p><b>لتحسين عملك:</b></p><ul>${ev.next.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : ""}</div>`);
const tsSubView = (sub, i) => `<div class="sheet"><p class="muted small">المحاولة ${i + 1} · ${esc(String(sub.at).slice(0, 10))} · ${esc(sub.name || "")}${sub.dur ? ` · فيديو ${sub.dur} ثانية` : ""}${sub.path ? ` · <a class="lnk" data-sb="submissions" data-path="${esc(sub.path)}" target="_blank" rel="noopener">الملف الأصلي</a>` : ""}</p>${sub.note ? `<p><b>شرح الطالبة:</b> ${esc(sub.note)}</p>` : ""}${subThumbs(sub)}</div>`;
A.tsReview = (el) => {
  const T = S.tasks[el.dataset.id], sid = el.dataset.s, st = T.students[sid], s = stu(sid), max = tkMax(T), need = (max * T.mastery) / 100, ev = st.ev;
  const subs = st.subs || [], val = st.tg != null ? st.tg : ev ? ev.total : "";
  modal(`<h3>${esc(T.title)} – ${nm(s)}</h3><p>${tsPill(st.status)} <span class="muted">محك الإتقان ${fmt(need)} من ${fmt(max)} (<bdi dir="ltr">${T.mastery}%</bdi>)</span></p>
    ${subs.length ? tsSubView(subs[subs.length - 1], subs.length - 1) : `<p class="muted">لم تسلّم بعد.</p>`}
    ${tsRubricTable(T, ev, st.status === "mastered" ? st.tg : null)}${tsFeedback(ev)}
    ${ev ? `<p class="note ${ev.total >= need ? "ok" : "warn"}">${ev.total >= need ? "التقييم الأولي بلغ محك الإتقان." : "التقييم الأولي دون محك الإتقان."} القرار لكِ.</p>` : ""}
    ${subs.length > 1 ? `<details class="sheet"><summary>المحاولات السابقة (${subs.length - 1})</summary>${subs.slice(0, -1).map(tsSubView).join("")}</details>` : ""}
    <div class="row wrap"><label class="fld sm">الدرجة المعتمدة (من ${fmt(max)})<input id="tsG" type="number" step="0.5" min="0" max="${max}" value="${val}"></label><label class="fld" style="flex:1">ملاحظتك للطالبة<input id="tsN" value="${esc(st.tnote || "")}" data-keep></label></div>
    <div class="row end"><button class="btn ghost" data-act="tsDecide" data-id="${esc(T.id)}" data-s="${sid}" data-st="retry">تحتاج محاولة أخرى</button><button class="btn" data-act="tsDecide" data-id="${esc(T.id)}" data-s="${sid}" data-st="mastered">أتقنت المهارة</button></div>`, true);
};
A.tsDecide = (el) => guard(async () => {
  const T = S.tasks[el.dataset.id], sid = el.dataset.s, v = $("#tsG").value, tg = v === "" ? null : Math.max(0, Math.min(tkMax(T), +v)), tnote = $("#tsN").value.trim(), status = el.dataset.st;
  if (status === "mastered" && tg != null && tg < (tkMax(T) * T.mastery) / 100 && !el.dataset.sure) { el.dataset.sure = "1"; el.textContent = "تأكيد: أتقنت رغم أن الدرجة دون المحك"; return; }
  await Store.set(`taskgrade/${T.id}/${sid}`, { status, tg, tnote });
  Object.assign(T.students[sid], { status, tg, tnote }); A.close(); render();
}, "حُفظ القرار، ويظهر في صفحة الطالبة.");

/* ---------- inside the student report (teacher) and on the student's own page ---------- */
function setTasksMini(sid) {
  const mine = tsList().filter((T) => T.students[sid]);
  if (!mine.length) return "";
  return `<h4>المهام الأدائية حتى الإتقان</h4><ul class="sendl">${mine.map((T) => { const st = T.students[sid]; return `<li><span>${esc(T.title)} <small class="muted">${(st.subs || []).length} محاولة</small></span>${tsPill(st.status)}${(st.subs || []).length ? `<button class="lnk" data-act="tsReview" data-id="${esc(T.id)}" data-s="${sid}">مراجعة</button>` : ""}</li>`; }).join("")}</ul>`;
}
function setTasksStudent(sid) {
  const mine = tsList().filter((T) => T.students[sid]);
  if (!mine.length) return "";
  const canSubmit = S.role === "student";
  return `<section class="card"><h2>مهامي الأدائية</h2>${mine.map((T) => {
    const st = T.students[sid], max = tkMax(T), kinds = TK_DEL[T.del] || TK_DEL.any, last = tsLast(st);
    const msg = st.status === "mastered" ? `<p class="note ok"><b>أحسنتِ! أتقنتِ المهارة.</b>${st.tg != null ? ` الدرجة المعتمدة ${fmt(st.tg)} من ${fmt(max)}.` : ""}</p>`
      : st.status === "retry" ? `<p class="note warn"><b>اقتربتِ! تحتاجين محاولة أخرى.</b> اقرئي ملاحظات التقييم ثم سلّمي نسخة محسّنة.</p>`
      : st.status === "submitted" ? `<p class="note">سلّمتِ عملك، وهو الآن عند المعلمة للمراجعة.</p>` : "";
    return `<div class="tk"><h5>${esc(T.title)}</h5><p class="muted small">في مهاراتي: ${(T.skills || []).map((id) => esc((sk(id) || {}).name || "")).join("، ")}${T.due ? ` · آخر موعد ${esc(T.due)}` : ""} · أُتقنها عند ${T.mastery}% (${fmt((max * T.mastery) / 100)} من ${fmt(max)})</p>
      ${msg}<div class="plan" data-keep>${esc(T.desc).replace(/\n/g, "<br>")}</div>
      <p><b>بنود التقييم</b></p>${tsRubricTable(T, st.ev, st.status === "mastered" ? st.tg : null)}${tsFeedback(st.ev)}${st.tnote ? `<p><b>ملاحظة المعلمة:</b> ${esc(st.tnote)}</p>` : ""}
      ${last ? `<p class="muted small">آخر تسليم ${esc(String(last.at).slice(0, 10))} · المحاولات ${(st.subs || []).length}</p>${subThumbs(last)}` : ""}
      ${st.status !== "mastered" && canSubmit ? `<div class="tkup"><label class="fld">${last ? "تسليم محاولة جديدة" : "سلّمي عملك"} (${kinds})<input type="file" id="tsFile-${esc(T.id)}" accept="${TK_ACCEPT[T.del] || TK_ACCEPT.any}"></label>
        <label class="fld">اشرحي عملك باختصار (اختياري)<textarea id="tsNote-${esc(T.id)}" rows="3" data-keep></textarea></label>
        <div class="row"><button class="btn" data-act="tsSubmit" data-id="${esc(T.id)}">تسليم العمل وتقييمه</button></div><div id="tsOut-${esc(T.id)}"></div></div>` : ""}</div>`;
  }).join("")}</section>`;
}
A.tsSubmit = (el) => guard(async () => {
  const T = S.tasks[el.dataset.id], sid = S.sid, st = T.students[sid], fi = $("#tsFile-" + T.id), f = fi && fi.files && fi.files[0], out = $("#tsOut-" + T.id), note = (($("#tsNote-" + T.id) || {}).value || "").trim();
  if (!f) throw { message: "اختاري ملف عملك أولًا." };
  const kind = /^video\//.test(f.type) ? "vid" : f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? "pdf" : /^image\//.test(f.type) ? "img" : "";
  if (!kind) throw { message: "ارفعي صورة أو ملف PDF أو فيديو." };
  el.disabled = true; const say = (m) => out && (out.innerHTML = `<p class="note">${m}</p>`);
  try {
    say(kind === "vid" ? "جارٍ أخذ لقطات من الفيديو…" : kind === "pdf" ? "جارٍ قراءة صفحات الملف…" : "جارٍ تجهيز الصورة…");
    let frames, dur = 0; if (kind === "vid") { const v = await vidFrames(f); frames = v.frames; dur = v.dur; } else frames = kind === "pdf" ? await pdfFrames(f) : await imgFrames(f);
    const th = []; for (const cv of frames.filter((_, i) => kind !== "vid" || i % 2 === 0).slice(0, 4)) th.push(fitCanvas(cv, cv.width, cv.height, 420).toDataURL("image/jpeg", 0.6));
    say("جارٍ رفع عملك…");
    let path = ""; try { if (f.size <= 50 * 1048576) path = await Store.uploadSubmission(f, sid, T.id); } catch (e) { /* the frames are enough */ }
    const sub = { at: new Date().toISOString(), kind, name: f.name, size: f.size, note, th, path, dur: Math.round(dur) };
    say(`${IC.ai} يقيّم الذكاء الاصطناعي عملك حسب بنود التقييم…`);
    const blobs = []; for (const cv of frames) blobs.push(await toBlob(cv, 0.82));
    const ev = await Store.submitTask({ sid, tid: null, taskId: st.rowId, setId: T.id, sub, frames: blobs, kind, note, dur });
    Object.assign(st, { status: "submitted", ev, tg: null, subs: [...(st.subs || []), sub] });
    render();
  } finally { el.disabled = false; }
}, "سُلّم العمل، وسيصل إلى المعلمة للمراجعة.");

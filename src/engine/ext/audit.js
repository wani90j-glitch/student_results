/* ===== Audit log view (accountability) =====
 * Entries are written by the database itself on every change to a mark, an improvement result, an approved task
 * grade, a sent sheet, the roster or a test; nobody can edit or delete them from the app. */
const AUD_ROLE = { teacher: "المعلمة", student: "الطالبة / وليّ الأمر", server: "النظام (استيراد)" };
function auditText(e) {
  const d = e.detail || {}, n = (v) => (v == null ? "—" : fmt(+v));
  switch (e.entity) {
    case "test_results":
      if (e.action === "insert") return `إدخال درجة: ${n(d.to)}`;
      if (e.action === "delete") return `حذف الدرجة (كانت ${n(d.from)})`;
      return `${(d.changed || []).map(([q, a, b]) => `السؤال ${q}: ${n(a)} ← ${n(b)}`).join("، ")} · المجموع ${n(d.from)} ← ${n(d.to)}`;
    case "improvement_items": return e.action === "insert" ? `إنشاء اختبار تحسين (${d.of} سؤالًا)` : e.action === "delete" ? "حذف اختبار تحسين" : `درجة التحسين: ${n(d.from)} ← ${n(d.to)} من ${d.of}`;
    case "perf_tasks": return `درجة المهمة الأدائية المعتمدة: ${n(d.from)} ← ${n(d.to)}`;
    case "sheets": return d.file ? "رفع ملف ورقة الإجابة" : d.sent ? "إرسال الورقة إلى وليّ الأمر" : "سحب الورقة من صفحة الطالبة";
    case "students": return e.action === "insert" ? "إضافة طالبة إلى القائمة" : "حذف طالبة من القائمة";
    case "tests": return e.action === "insert" ? `إنشاء اختبار (${d.questions} سؤالًا)` : "حذف اختبار";
    default: return e.action;
  }
}
function auditSection(t) {
  if (!S.audit || S.audit.at < Date.now() - 60000) {
    if (!S.auditBusy) { S.auditBusy = true; Store.auditLog().then((list) => { S.audit = { list, at: Date.now() }; }).catch(() => { S.audit = { list: [], at: Date.now(), err: true }; }).finally(() => { S.auditBusy = false; if (route() === "quality") render(); }); }
    if (!S.audit) return `<section class="card"><h2>6. سجل التعديلات (المساءلة)</h2><p class="muted">جارٍ تحميل السجل…</p></section>`;
  }
  const keys = new Set([t.id, ...impsOf(t.id).map((m) => m.id), ...impsOf(t.id).map((m) => m.id + "_g")]);
  const list = S.audit.list.filter((e) => e.test_id === t.id || (e.detail && (keys.has(e.detail.round) || keys.has(e.detail.key))));
  const who = (sid) => { const s = stu(sid); return s ? `ورقة ${s.no} · ${esc(s.cls)}` : sid ? `<span dir="ltr">${esc(sid)}</span>` : "—"; };
  const changes = list.filter((e) => e.action === "update").length;
  return `<section class="card"><h2>6. سجل التعديلات (المساءلة)</h2>
    <p class="muted">تكتبه قاعدة البيانات تلقائيًا عند كل تغيير في درجة أو نتيجة تحسين أو درجة مهمة أو إرسال ورقة، ولا يمكن تعديله ولا حذفه من المنصة. يُعرَّف بالطالبة برقم الورقة والفصل دون اسمها.</p>
    <div class="grid4"><div class="tile"><b>${list.length}</b><span>قيدًا لهذا الاختبار</span></div><div class="tile"><b>${changes}</b><span>تعديلًا بعد الإدخال الأول</span></div></div>
    ${list.length ? `<details class="sheet"${changes ? " open" : ""}><summary>عرض القيود (${list.length})</summary><div class="scroll"><table class="tbl"><thead><tr><th>الوقت</th><th>من</th><th>الطالبة</th><th>التغيير</th></tr></thead><tbody>${list.slice(0, 400).map((e) => `<tr><td class="num"><small>${esc(String(e.at).slice(0, 16).replace("T", " "))}</small></td><td>${AUD_ROLE[e.actor_role] || "—"}</td><td>${who(e.student_id)}</td><td>${auditText(e)}</td></tr>`).join("")}</tbody></table></div></details>` : `<p class="muted">لا توجد قيود بعد.</p>`}</section>`;
}

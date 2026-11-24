/* ===== Official class documents (added in the new platform) =====
 * 1) «كشف درجات العلوم بعد التحسين»: one table per class — period mark, improvement mark, mark after improvement, note.
 * 2) «نتائج تصحيح اختبار التحسين»: the same summary followed by each student's graded improvement paper(s).
 * Same header, fonts and table style as the platform's other papers. */
const impOf = (t, sid) => { // all graded improvement rounds of this test, for one student
  let got = 0, of = 0, any = false;
  impsOf(t.id).forEach((m) => { const it = m.items[sid], r = (m.results || {})[sid]; if (!it) return; of += it.length; if (r) { any = true; got += r.reduce((a, v) => a + (+v ? 1 : 0), 0); } });
  return { got, of, any };
};
function gradeRows(t, cls) {
  return sortedStudents(cls).filter((s) => t.results[s.id]).map((s, i) => {
    const x = studentStats(t, s.id), im = impOf(t, s.id), still = x.missing.map((o) => (sk(o.id) || {}).name).filter(Boolean);
    return { no: i + 1, s, base: x.base, total: x.total, imp: im.of ? (im.any ? `${im.got} من ${im.of}` : `— من ${im.of}`) : "—", after: x.score, note: still.length ? still.join("، ") : "أتقنت جميع المهارات" };
  });
}
function classTable(d, t, cls, title) {
  const s = S.settings, rows = gradeRows(t, cls), tot = testMax(t), W = d.W - 2 * MG, R = d.W - MG, size = 20, lh = size * 1.45;
  header(d, [["المادة", s.subject], ["الصف", `${s.grade} ${cls}`], ["المعلمة", s.teacher], ["التاريخ", "      /      / " + s.year]]);
  titleBand(d, `${title} – ${t.name.replace(/^اختبار\s*/, "")} – ${s.grade} ${cls}`);
  d.y += 12;
  const cols = [["م", 0.05], ["اسم الطالبة", 0.27], [`درجة الفترة (من ${fmt(tot)})`, 0.12], ["درجة التحسين", 0.11], [`الدرجة بعد التحسين (من ${fmt(tot)})`, 0.13], ["ملاحظة: مهارات لم تُتقن بعد", 0.32]];
  const head = () => { let rx = R; cols.forEach(([c, w]) => { cell(d.x, rx, d.y, w * W, 62, lines(d.x, c, w * W, 19, 700), { fill: "#1f1f1f", color: "#fff", w: 700, size: 19 }); rx -= w * W; }); d.y += 62; };
  head();
  rows.forEach((r) => {
    const vals = [String(r.no), r.s.name, fmt(r.base), r.imp, fmt(r.after), r.note];
    const ls = vals.map((v, c) => lines(d.x, v, cols[c][1] * W, c === 5 ? 18 : size, c === 4 ? 700 : 400)), h = Math.max(...ls.map((l) => l.length)) * lh + 12;
    if (ensure(d, h)) head();
    let rx = R;
    ls.forEach((l, c) => { cell(d.x, rx, d.y, cols[c][1] * W, h, l, { size: c === 5 ? 18 : size, align: c === 1 || c === 5 ? "right" : "center", w: c === 4 ? 700 : 400, fill: c === 4 ? (r.after >= tot ? "#e2f3ea" : WARM) : null }); rx -= cols[c][1] * W; });
    d.y += h;
  });
  const n = rows.length, m0 = n ? rows.reduce((a, r) => a + r.base, 0) / n : 0, m1 = n ? rows.reduce((a, r) => a + r.after, 0) / n : 0, full = rows.filter((r) => r.after >= tot).length;
  ensure(d, 110); d.y += 14;
  text(d, `عدد الطالبات: ${n}  |  متوسط درجة الفترة: ${fmt(Math.round(m0 * 10) / 10)} من ${fmt(tot)}  |  المتوسط بعد التحسين: ${fmt(Math.round(m1 * 10) / 10)} من ${fmt(tot)}  |  أتقنّ جميع المهارات: ${full}`, { size: 21, w: 700 });
  d.y += 18; text(d, "التوقيع: ............................", { size: 21 });
  return rows;
}
function docGrades(t, cls) {
  const d = newDoc({ land: true, footer: "كشف الدرجات بعد التحسين" });
  (cls ? [cls] : classes()).filter((c) => sortedStudents(c).some((s) => t.results[s.id])).forEach((c, i) => { if (i) addPage(d); classTable(d, t, c, `كشف درجات ${S.settings.subject} بعد التحسين`); });
  finishPages(d); return d;
}
/** Summary per class, then each student's graded improvement paper(s), one page each. */
async function docImpResults(t, cls) {
  const ms = impsOf(t.id), keyOf = (sid) => { for (let k = ms.length - 1; k >= 0; k--) { const v = (S.sheets[ms[k].id + "_g"] || {})[sid]; if (v && !String(v).startsWith("legacy:")) return v; } return null; };
  const want = [];
  const d = newDoc({ land: true, footer: "نتائج تصحيح اختبار التحسين" });
  (cls ? [cls] : classes()).filter((c) => sortedStudents(c).some((s) => t.results[s.id])).forEach((c, i) => {
    if (i) addPage(d);
    const rows = classTable(d, t, c, "نتائج تصحيح اختبار التحسين");
    rows.forEach((r) => { const v = keyOf(r.s.id); if (v) want.push({ r, cls: c, pages: (S.sheetPages || {})[v] || [v] }); });
  });
  const urls = await Store.signedUrls(want.flatMap((w) => w.pages.map((p) => ({ bucket: "sheets", path: p }))));
  const load = (u) => new Promise((ok) => { if (!u) return ok(null); const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = u; });
  for (const w of want) for (let k = 0; k < w.pages.length; k++) {
    const im = await load(urls["sheets:" + w.pages[k]]);
    addPage(d);
    const x = d.x, W = d.W - 2 * MG, top = MG;
    setFont(x, 22, 700); x.fillText(`${w.r.no}) ${w.r.s.name} – ${w.cls} – بعد التحسين: ${fmt(w.r.after)} من ${fmt(w.r.total)}${w.pages.length > 1 ? ` – صفحة ${k + 1} من ${w.pages.length}` : ""}`, d.W - MG, top + 26);
    if (im) { const box = d.H - top - 60 - MG, r = Math.min(W / im.width, box / im.height), iw = im.width * r, ih = im.height * r; x.drawImage(im, MG + (W - iw) / 2, top + 44, iw, ih); x.strokeRect(MG + (W - iw) / 2, top + 44, iw, ih); }
    else { setFont(x, 22, 400); x.fillText("تعذّر تحميل صورة الورقة.", d.W - MG, top + 90); }
  }
  finishPages(d); return { d, sheets: want.length };
}
A.pdfGrades = (el) => { const t = S.tests[el.dataset.id] || curTest(), c = el.dataset.cls || ""; pdfBusy("كشف الدرجات بعد التحسين", () => docGrades(t, c), `كشف درجات ${S.settings.subject || ""} بعد التحسين${c ? " " + c.replace("/", "-") : ""}`); };
A.pdfImpResults = (el) => guard(async () => {
  const t = S.tests[el.dataset.id] || curTest(), c = el.dataset.cls || "";
  toast("جارٍ تجهيز نتائج التصحيح مع الأوراق…"); await prepFonts();
  const r = await docImpResults(t, c);
  await savePDF(r.d, `نتائج تصحيح اختبار التحسين${c ? " " + c.replace("/", "-") : ""}.pdf`);
  toast(r.sheets ? `الملف جاهز: ${r.sheets} ورقة مصحَّحة.` : "الملف جاهز. لا توجد أوراق مصحَّحة مرفقة بعد؛ أرفقيها من «إرفاق أوراق مصحَّحة من ملف واحد».");
});
/** Buttons shown on the improvement page. */
function reportButtons(t) {
  const cs = classes();
  return `<section class="card"><h2>كشوف رسمية للطباعة</h2><p class="muted">كشف لكل فصل بدرجة الفترة ودرجة التحسين والدرجة بعده والمهارات التي لم تُتقن بعد، مع ترويسة المدرسة والتوقيع.</p>
    <div class="row wrap"><b>كشف الدرجات بعد التحسين:</b><button class="btn ghost sm" data-act="pdfGrades" data-id="${t.id}" data-cls="">${IC.dl} كل الفصول</button>${cs.map((c) => `<button class="btn ghost sm" data-act="pdfGrades" data-id="${t.id}" data-cls="${esc(c)}">${IC.dl} فصل ${esc(c)}</button>`).join("")}</div>
    <div class="row wrap"><b>نتائج تصحيح اختبار التحسين مع الأوراق المصحَّحة:</b><button class="btn ghost sm" data-act="pdfImpResults" data-id="${t.id}" data-cls="">${IC.dl} كل الفصول</button>${cs.map((c) => `<button class="btn ghost sm" data-act="pdfImpResults" data-id="${t.id}" data-cls="${esc(c)}">${IC.dl} فصل ${esc(c)}</button>`).join("")}</div>
    <div class="row wrap"><button class="btn" data-act="bulkOpen" data-id="${t.id}">إرفاق أوراق مصحَّحة من ملف واحد (PDF أو صور)</button><span class="muted">ترفعين ملفًا فيه أوراق فصل كامل، فيقرأ الذكاء الاصطناعي اسم كل طالبة ويربط صفحاتها بها، ثم تراجعين قبل الحفظ.</span></div></section>`;
}

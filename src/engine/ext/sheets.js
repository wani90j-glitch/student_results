/* ===== Attaching a whole class's scanned papers from one file (added in the new platform) =====
 * The teacher uploads one PDF (or several photos). Each page is shown to the AI, which reads only the student's
 * name / sheet number written on it; pages with no name continue the previous student. The teacher reviews and
 * corrects every match before anything is saved. Pages go to private storage under the chosen paper. */
let BULK = null; // { tid, key, cls, pages: [{blob, thumb, read, sid}] }
async function allPages(file) {
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return [{ blob: file, text: "" }];
  if (!window.pdfjsLib) { await loadScript("/vendor/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.js"; }
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, out = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 300); p++) {
    const page = await pdf.getPage(p), v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(2, 1800 / Math.max(v0.width, v0.height)) }), c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    const tc = await page.getTextContent().catch(() => null), text = tc ? tc.items.map((it) => it.str).join(" ") : "";
    out.push({ blob: await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85)), text });
    const el = $("#bulkOut"); if (el) el.innerHTML = `<p class="note">جارٍ تجهيز الصفحات… ${p} من ${pdf.numPages}</p>`;
  }
  return out;
}
const thumbOf = (blob) => new Promise((ok) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { const r = 150 / Math.max(im.width, im.height), c = document.createElement("canvas"); c.width = im.width * r; c.height = im.height * r; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL("image/jpeg", 0.6)); }; im.onerror = () => ok(""); im.src = u; });
/** Best roster match for a name read from a page: most shared name parts (after Arabic normalisation). */
function matchName(name, list) {
  const toks = (v) => norm(v).split(" ").filter((w) => w.length > 1 && !/^(بنت|بن|ال)$/.test(w));
  const a = toks(name || ""); if (!a.length) return null;
  let best = null, score = 0;
  list.forEach((s) => { const b = toks(s.name), common = a.filter((w) => b.includes(w)).length, sc = common / Math.max(2, Math.min(a.length, b.length)) + (b[0] === a[0] ? 0.25 : 0); if (sc > score) { score = sc; best = s; } });
  return score >= 0.6 ? best : null;
}
A.bulkOpen = (el) => {
  const t = S.tests[el.dataset.id] || curTest(), ms = impsOf(t.id);
  BULK = { tid: t.id, key: ms.length ? ms[ms.length - 1].id + "_g" : t.id, cls: S.ui.cls || "", pages: [] };
  modal(`<h3>إرفاق أوراق مصحَّحة من ملف واحد</h3>
    <div class="row wrap"><label class="fld">نوع الأوراق<select id="bkKey" data-chg="bulkKey">${opt(t.id, "أوراق إجابة " + t.name, BULK.key)}${ms.map((m) => opt(m.id + "_g", roundName(m) + " بعد التصحيح", BULK.key)).join("")}</select></label>
      <label class="fld sm">الفصل<select id="bkCls" data-chg="bulkCls">${opt("", "كل الفصول", BULK.cls)}${classes().map((c) => opt(c, "فصل " + c, BULK.cls)).join("")}</select></label></div>
    <p class="muted">اختاري ملف PDF واحدًا (أو عدة صور). يقرأ الذكاء الاصطناعي الاسم المكتوب على كل صفحة فقط، والصفحة التي ليس عليها اسم تُضم إلى الطالبة السابقة. لا يُحفظ شيء قبل مراجعتك.</p>
    <label class="btn">اختيار الملف<input type="file" accept="application/pdf,image/*" multiple hidden data-chg="bulkFile"></label><div id="bulkOut"></div>`, true);
};
function bulkGrid() {
  const list = sortedStudents(BULK.cls), done = BULK.pages.filter((p) => p.sid).length;
  return `<p><b>${BULK.pages.length}</b> صفحة · رُبطت ${done}. راجعي كل صفحة، وصحّحي الطالبة عند الحاجة، أو اختاري «تجاهل الصفحة».</p>
    <div class="scroll" style="max-height:55vh"><table class="tbl"><thead><tr><th>الصفحة</th><th>المقروء</th><th>الطالبة</th></tr></thead><tbody>${BULK.pages.map((p, i) => `<tr><td><img src="${p.thumb}" alt="صفحة ${i + 1}" style="width:110px;border:1px solid #ccd"><br><small class="muted">${i + 1}</small></td><td><small>${p.read ? esc(p.read) : p.cont ? "تكملة للصفحة السابقة" : "—"}</small></td><td><select class="pii" data-chg="bulkSid" data-i="${i}">${opt("", "— تجاهل الصفحة —", p.sid || "")}${list.map((s) => opt(s.id, `${s.no}. ${s.name} (${s.cls})`, p.sid || "")).join("")}</select></td></tr>`).join("")}</tbody></table></div>
    <div class="row end"><button class="btn" data-act="bulkSave">حفظ الأوراق في تقارير الطالبات</button></div>`;
}
Object.assign(C, {
  bulkKey: (el) => { BULK.key = el.value; },
  bulkCls: (el) => { BULK.cls = el.value; },
  bulkSid: (el) => { BULK.pages[+el.dataset.i].sid = el.value; },
  bulkFile: (el) => guard(async () => {
    const files = [...el.files]; if (!files.length) return;
    const out = $("#bulkOut"), list = sortedStudents(BULK.cls);
    const pages = []; for (const f of files) pages.push(...(await allPages(f)));
    const blobs = pages.map((p) => p.blob);
    // 1) pages that carry text (e.g. sheets exported by the automatic marking program): match by ID number, then by name
    const digits = (t) => [...new Set((String(t).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).match(/\b[12]\d{9}\b/g) || []))];
    const byPin = await Store.matchPins([...new Set(pages.flatMap((p) => digits(p.text)))]).catch(() => ({}));
    const inList = new Set(list.map((s) => s.id));
    BULK.pages = [];
    let last = "";
    for (let i = 0; i < blobs.length; i++) {
      const ids = digits(pages[i].text), txt = pages[i].text.replace(/\s+/g, " ").trim();
      if (ids.length > 1) { BULK.pages.push({ blob: blobs[i], thumb: await thumbOf(blobs[i]), read: `صفحة فيها ${ids.length} طالبات (قائمة)`, cont: false, sid: "" }); last = ""; continue; }
      if (ids.length === 1 || txt.length > 40) {
        const sid = ids.length === 1 && byPin[ids[0]] && inList.has(byPin[ids[0]]) ? byPin[ids[0]] : (matchName(txt.replace(/[\d|:،,-]+/g, " "), list) || {}).id || "";
        BULK.pages.push({ blob: blobs[i], thumb: await thumbOf(blobs[i]), read: sid ? (ids.length === 1 ? "رقم الهوية في الصفحة" : "الاسم في الصفحة") : "نص الصفحة لم يُطابَق", cont: false, sid });
        last = sid; continue;
      }
      // 2) scanned pages without text: the AI reads the name only
      out.innerHTML = `<p class="note">${IC.ai} جارٍ قراءة اسم الطالبة في الصفحة ${i + 1} من ${blobs.length}…</p>`;
      let r = null;
      try { r = await Store.sample.json(`هذه صفحة من ورقة اختبار مدرسي مصحَّحة لطالبة. اقرأ فقط اسم الطالبة المكتوب على الصفحة (في الترويسة أو أعلى الورقة) ورقم الورقة إن وُجد. لا تقرأ الإجابات ولا الدرجات. إن لم يكن على الصفحة اسم طالبة (مثل صفحة ثانية من الورقة نفسها) فأعد name = null. أعد JSON فقط: {"name": "الاسم كما هو مكتوب أو null", "sheet": رقم الورقة أو null}`, { images: [blobs[i]] }); } catch (e) { r = null; }
      const read = r && r.name ? String(r.name) : "", bySheet = r && r.sheet ? list.find((s) => s.no === +r.sheet) : null;
      const st = bySheet || (read ? matchName(read, list) : null);
      const sid = st ? st.id : read ? "" : last;
      if (sid) last = sid;
      BULK.pages.push({ blob: blobs[i], thumb: await thumbOf(blobs[i]), read, cont: !read && !!sid, sid });
    }
    out.innerHTML = bulkGrid();
  }),
});
A.bulkSave = (el) => guard(async () => {
  const by = {}; BULK.pages.forEach((p) => { if (p.sid) (by[p.sid] = by[p.sid] || []).push(p.blob); });
  const ids = Object.keys(by); if (!ids.length) throw { message: "لم تُربط أي صفحة بطالبة." };
  el.disabled = true;
  S.sheets[BULK.key] = S.sheets[BULK.key] || {}; S.sheetPages = S.sheetPages || {};
  for (let k = 0; k < ids.length; k++) {
    el.textContent = `جارٍ الحفظ ${k + 1} من ${ids.length}…`;
    const pages = await Store.uploadSheet(by[ids[k]], ids[k], BULK.key);
    S.sheets[BULK.key][ids[k]] = pages[0]; S.sheetPages[pages[0]] = pages;
  }
  await save.sheets(BULK.key);
  A.close(); render(); toast(`حُفظت أوراق ${ids.length} طالبة. أرسليها لأولياء الأمور من «اختبار التحسين» أو من تقرير كل طالبة.`);
});

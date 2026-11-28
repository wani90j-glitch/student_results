#!/usr/bin/env python3
"""
Builds src/engine/itqan.js from the original single-file app (itqan-source.html, git-ignored).

The original UI code is kept as it is (same screens, wording, colours, calculations); only the parts that
touched the old storage, the old login and Claude's in-artifact services are replaced, each replacement listed
below. The script stops if any expected piece of the source is missing, so a silent mis-port is impossible.
Run:  python3 scripts/port-engine.py itqan-source.html
"""
import re
import sys

src = open(sys.argv[1] if len(sys.argv) > 1 else "itqan-source.html", encoding="utf-8").read()
lines = src.split("\n")
start = next(i for i, l in enumerate(lines) if "/* ===== Itqan core: storage, state" in l)
end = next(i for i, l in enumerate(lines) if i > start and l.strip() == "</script>")
code = "\n".join(lines[start:end])


def sub(old, new, count=1):
    """Exact replacement; fails loudly when the source does not contain `old` exactly `count` times."""
    global code
    n = code.count(old)
    if n != count:
        sys.exit(f"port-engine: expected {count} x {old[:90]!r}, found {n}")
    code = code.replace(old, new)


def cut(start_pat, end_pat, new=""):
    """Replaces the block from the line matching start_pat up to (not including) the line matching end_pat."""
    global code
    a = re.search(start_pat, code, re.M)
    if not a:
        sys.exit(f"port-engine: start not found {start_pat}")
    b = re.search(end_pat, code[a.end():], re.M)
    if not b:
        sys.exit(f"port-engine: end not found {end_pat}")
    code = code[: a.start()] + new + code[a.end() + b.start():]


# 1. storage: the in-artifact database is replaced by the Supabase adapter handed in by boot()
cut(r"^/\* ---------- storage: artifact database", r"^/\* ---------- state ---------- \*/", "")
# school-specific defaults come from the database; no names are hard-coded in the code
sub('school: "المتوسطة الأولى بالتوبي", region: "الإدارة العامة للتعليم بالمنطقة الشرقية", teacher: "أ/ وفاء الزهراني", subject: "العلوم",',
    'school: "", region: "", teacher: "", subject: "العلوم",')

# 2. loading: one-off importers and the demo builder are gone; data comes from the adapter
cut(r"^function buildDemo\(\)", r"^/\* ---------- analysis ---------- \*/", """async function loadAll() {
  try {
    const d = await Store.load(S.role);
    Object.assign(S, d);
    S.settings = Object.assign({}, DEF_SETTINGS, d.settings || {});
    if (!S.subjects || !S.subjects.length) S.subjects = [{ id: "sci9", name: S.settings.subject || "العلوم", grade: S.settings.grade || "" }];
    S.loaded = true; S.loadError = null;
  } catch (e) {
    console.error(e);
    S.loadError = "تعذّر الوصول إلى البيانات الآن. تحققي من الاتصال ثم أعيدي فتح الصفحة.";
    S.settings = S.settings || Object.assign({}, DEF_SETTINGS);
    S.loaded = true;
  }
}

""")

# 3. student page: gap targets for other classes are computed on the server (the student never receives classmates' data)
sub("""  if (mode === "crit") return { all: c.crit, K: c.crit, A: c.crit, R: c.crit };""",
    """  if (mode === "crit") return { all: c.crit, K: c.crit, A: c.crit, R: c.crit };
  if (S.role === "student" && S.gapPre && S.gapPre[t.id]) return S.gapPre[t.id][mode === "cls" ? "cls" : "all"];""")
sub("""  const c = gapCfg(), grp = c.mode === "crit" ? null : groupStats(t, c.mode === "cls" ? s.cls : ""), gm = {};
  if (grp) grp.skills.forEach((o) => (gm[o.id] = o.pct));""",
    """  const c = gapCfg(), pre = S.role === "student" && S.gapPre && S.gapPre[t.id], grp = c.mode === "crit" || pre ? null : groupStats(t, c.mode === "cls" ? s.cls : ""), gm = {};
  if (grp) grp.skills.forEach((o) => (gm[o.id] = o.pct));
  if (pre && c.mode !== "crit") Object.assign(gm, pre.skills[c.mode === "cls" ? "cls" : "all"] || {});""")
sub("""const done = testsSorted().filter((t) => t.results && Object.keys(t.results).length), last = done[0];""",
    """const done = testsSorted().filter((t) => t._n || (t.results && Object.keys(t.results).length)), last = done[0];""")

# 4. landing page: live figures (standard deviation instead of an effect size), no demo ID hint
sub("""<div class="hstats"><div><b dir="ltr">79% → 91%</b><span>متوسط 116 طالبة</span></div><div><b dir="ltr">d = 0.83</b><span>حجم أثر كبير</span></div><div><b dir="ltr">96%</b><span>ممن أُعيد اختبارهن تحسّنّ</span></div></div>""",
    "")  # the teacher asked to remove the figures from the landing page
sub("""function renderLanding() {""", """function hstats() {
  const p = S.pub;
  if (!p || !p.n) return "";
  return `<div class="hstats"><div><b dir="ltr">${p.meanPctBefore}% → ${p.meanPctAfter}%</b><span>متوسط ${p.n} طالبة</span></div><div><b dir="ltr">SD ${p.sdBefore} → ${p.sdAfter}</b><span>الانحراف المعياري قبل التحسين وبعده</span></div><div><b dir="ltr">${p.improvedPct}%</b><span>ممن أُعيد اختبارهن تحسّنّ</span></div></div>`;
}
function renderLanding() {""")
sub("""        ${Store.canTeach ? `<button class="door" data-act="asTeacher">""", """        ${true ? `<button class="door" data-act="asTeacher">""")
sub("""          ${s.demo && S.roster[0] ? `<small class="muted">للتجربة: ${esc(S.roster[0].nid)}${s.pinOn && S.roster[0].pin ? " · الرمز " + esc(S.roster[0].pin) : ""}</small>` : ""}<small id="loginErr" class="err"></small></form>""",
    """<small id="loginErr" class="err"></small></form>""")

# 4b. the platform's name and slogan (domain itqanloop.com): the loop from diagnosis to mastery
sub("""<p class="lead">التقويم لا يكتمل عند الدرجة… بل عند الإتقان</p>""",
    """<p class="lead">التقويم لا يكتمل عند الدرجة… بل عند الإتقان</p><p class="loopline"><b>حلقة تبدأ بالتشخيص… ولا تنتهي إلا بالإتقان</b><span>نقيس • نحلّل • نعالج • نعيد التقويم</span></p>""")

# 5. sign-in: teacher by e-mail + password (+ optional authenticator code); student by her PIN through the server
cut(r"^async function hashPw\(pw, salt\)", r"^A\.clearDemo = ", """A.asTeacher = () => modal(`<h3>دخول المعلمة</h3><form id="tpForm" data-mode="enter"><label class="fld">البريد الإلكتروني<input id="tpE" type="email" autocomplete="username" dir="ltr" required></label><label class="fld">كلمة المرور<input id="tp1" type="password" autocomplete="current-password" required></label><small id="tpErr" class="err"></small><div class="row end"><button class="lnk" type="button" data-act="tpForgot">نسيت كلمة المرور</button><button class="btn" type="submit">دخول</button></div></form>`);
A.tpForgot = () => guard(async () => { const e = ($("#tpE") || {}).value || ""; if (!e.trim()) throw { message: "اكتبي بريدك الإلكتروني أولًا." }; await Store.resetPassword(e.trim()); }, "أُرسل رابط تعيين كلمة المرور إلى بريدك.");
A.tpChange = () => modal(`<h3>تغيير كلمة المرور</h3><form id="tpForm" data-mode="change"><label class="fld">كلمة المرور الجديدة<input id="tp1" type="password" autocomplete="new-password" minlength="10" required></label><label class="fld">تأكيد كلمة المرور<input id="tp2" type="password" autocomplete="new-password" minlength="10" required></label><small id="tpErr" class="err"></small><div class="row end"><button class="btn" type="submit">حفظ</button></div></form>`);
A.mfaSetup = () => guard(async () => {
  const f = await Store.mfaEnroll();
  modal(`<h3>التحقق بخطوتين</h3><p>امسحي الرمز بتطبيق المصادقة في جوالك (مثل Google Authenticator أو Microsoft Authenticator)، ثم اكتبي الرقم المكوّن من 6 خانات.</p><div class="row" style="justify-content:center"><img src="${esc(f.qr)}" alt="رمز QR" width="200" height="200" style="background:#fff;border-radius:12px"></div><p class="muted small" dir="ltr" style="text-align:center">${esc(f.secret)}</p><form id="tpForm" data-mode="mfaVerify" data-f="${esc(f.id)}"><label class="fld">الرمز من التطبيق<input id="tpC" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><small id="tpErr" class="err"></small><div class="row end"><button class="btn" type="submit">تفعيل</button></div></form>`);
});
A.mfaOff = () => guard(async () => { await Store.mfaDisable(); render(); }, "أُلغي التحقق بخطوتين.");
async function teacherPw(mode) {
  const err = (m) => { $("#tpErr").textContent = m; };
  try {
    if (mode === "enter") {
      const r = await Store.signIn($("#tpE").value.trim(), $("#tp1").value);
      if (r && r.setup) { S.role = "teacher"; A.importOpen(true); return; }
      if (r && r.mfa) { modal(`<h3>التحقق بخطوتين</h3><form id="tpForm" data-mode="mfa" data-f="${esc(r.factorId)}"><label class="fld">الرمز من تطبيق المصادقة<input id="tpC" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><small id="tpErr" class="err"></small><div class="row end"><button class="btn" type="submit">تأكيد</button></div></form>`); $("#tpC").focus(); return; }
    } else if (mode === "mfa" || mode === "mfaVerify") {
      await Store.mfaVerify($("#tpForm").dataset.f, $("#tpC").value.trim());
      if (mode === "mfaVerify") { A.close(); toast("فُعّل التحقق بخطوتين."); render(); return; }
    } else if (mode === "change") {
      const a = $("#tp1").value, b = $("#tp2").value;
      if (a.length < 10) return err("كلمة المرور 10 خانات على الأقل.");
      if (a !== b) return err("الكلمتان غير متطابقتين.");
      await Store.changePassword(a); A.close(); return toast("تغيّرت كلمة المرور.");
    }
  } catch (e) { return err(e && e.message ? e.message : "تعذّر الدخول."); }
  A.close();
  S.role = "teacher"; S.loaded = false; render(); await loadAll();
  if (nowClass().cur && route() === "home") { location.hash = "live"; }
  render();
}
A.logout = () => guard(async () => { await Store.signOut(); S.role = null; S.sid = null; S.peek = false; S.ui = {}; S.ui.tour = null; S.roster = []; S.tests = {}; S.imps = {}; S.acks = {}; render(); tourDraw(); });
async function login(nid) {
  const e = $("#loginErr"); e.textContent = "";
  try {
    const r = await Store.studentLogin(nid);
    S.role = "student"; S.sid = r.sid; S.loaded = false; render(); await loadAll(); render();
  } catch (x) {
    e.textContent = x && x.code === "rate" ? "محاولات كثيرة. انتظري قليلًا ثم حاولي مرة أخرى." : "الرقم السري غير صحيح. تأكدي من الرقم أو راجعي معلمة المادة.";
  }
}
""")

# 6. roster: the national ID is sent once to the server to be hashed, then forgotten; the screen never shows it
sub("""const maskId = (v) => `<span class="pii" dir="ltr">••••••${esc(String(v).slice(-4))}</span>`;""",
    """const maskId = (s) => (s && s.hasPin) || (s && s.nid) ? `<span class="chip ok">محفوظ مشفّرًا</span>` : `<button class="lnk" data-act="pinSet" data-id="${esc(s ? s.id : "")}">إدخال الرقم السري</button>`;""")
sub("""<td class="num">${maskId(s.nid)}</td>""", """<td class="num">${maskId(s)}</td>""")
sub("""<p class="note warn">رقم الهوية هو الرقم السري لدخول الطالبة، ويُعرض هنا آخر 4 أرقام منه فقط. الأسماء مموّهة حتى تضغطي «إظهار الأسماء». لا تُدخلي أرقامًا حقيقية ما دامت الصفحة مشاركة برابط عام.</p>""",
    """<p class="note warn">رقم الهوية هو الرقم السري لدخول الطالبة. لا يُحفظ الرقم نفسه في المنصة، بل بصمة مشفّرة منه فقط، فلا يظهر لأحد. الأسماء مموّهة حتى تضغطي «إظهار الأسماء».</p>""")
sub("""    if (r.nid && S.roster.some((s) => s.nid === r.nid)) return;
    no++; added++;
    S.roster.push({ id: "st" + no + Math.floor(Math.random() * 90 + 10), no, nid: r.nid || String(9000000000 + no), name: r.name, cls: r.cls, pin: newPin() });""",
    """    if (r.nid && S.roster.some((s) => s.nid === r.nid)) return;
    no++; added++;
    S.roster.push({ id: "st" + no + Math.random().toString(36).slice(2, 6), no, nid: r.nid || "", name: r.name, cls: r.cls });""")
sub("""A.rosterDel = (el) =>""", """A.pinSet = (el) => modal(`<h3>الرقم السري للطالبة</h3><p class="muted">اكتبي رقم هوية الطالبة. يُحفظ مشفّرًا فقط، ولن يظهر بعد الحفظ.</p><form id="pinForm" data-id="${esc(el.dataset.id)}"><label class="fld">رقم الهوية<input id="pinV" type="password" inputmode="numeric" autocomplete="off" required></label><div class="row end"><button class="btn" type="submit">حفظ</button></div></form>`);
A.rosterDel = (el) =>""")

# 7. matching a national ID in Excel files and photographed sheets goes through the server (the browser has no IDs)
sub("""    const e = S.ui.entry, qs = S.tests[e.id].qs, rows = await readSheet(file); let n = 0, miss = 0;""",
    """    const e = S.ui.entry, qs = S.tests[e.id].qs, rows = await readSheet(file); let n = 0, miss = 0;
    const byPin = await Store.matchPins(rows.map((r) => String(r[0] || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\\D/g, "")).filter((d) => /^\\d{8,}$/.test(d)));""")
sub("""const st = (/^\\d{8,}$/.test(digits) && S.roster.find((s) => s.nid === digits)) || S.roster.find((s) => norm(s.name) === norm(key));""",
    """const st = (/^\\d{8,}$/.test(digits) && stu(byPin[digits])) || S.roster.find((s) => norm(s.name) === norm(key));""")
sub("""      const st = S.roster.find((s) => kind !== "omr" && s.no === +(r && r.sheet)) || (idDigits && S.roster.find((s) => s.nid === idDigits)) ||""",
    """      const byPin = idDigits ? await Store.matchPins([idDigits]).catch(() => ({})) : {};
      const st = S.roster.find((s) => kind !== "omr" && s.no === +(r && r.sheet)) || (idDigits && stu(byPin[idDigits])) ||""")
sub("""const key = String(r[0] || "").trim(); if (!key || /^(الطالبة|الاسم|اسم|المهارة|المستوى)/.test(key)) return;
      const digits = key.replace(/\\D/g, "");""",
    """const key = String(r[0] || "").trim(); if (!key || /^(الطالبة|الاسم|اسم|المهارة|المستوى)/.test(key)) return;
      const digits = key.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\\D/g, "");""")

# 8. scanned sheets: private storage + short-lived signed links (images and PDFs, on every device)
cut(r"^const FILE_SHEETS = \{\};", r"^function reportHTML\(sid, t, asTeacher\)", """const fileSheet = () => "";
/** Pages of a stored sheet. Each <img> gets a signed link after rendering (see Store.hydrate). */
function sheetImg(id, alt) {
  if (!id) return "";
  if (String(id).startsWith("legacy:")) return `<p class="note warn">هذه الورقة لم تُرفع بعد إلى المنصة الجديدة. ${S.role === "teacher" ? "أرفقيها من زر «إرفاق صورة ورقة الإجابة»." : "اطلبيها من المعلمة."}</p>`;
  const pages = (S.sheetPages && S.sheetPages[id]) || [id];
  return pages.map((p, i) => `<img class="shimg" data-sb="sheets" data-path="${esc(p)}" alt="${esc(alt)}${pages.length > 1 ? " – صفحة " + (i + 1) : ""}" onerror="sheetImgFail(this)">`).join("") + `<a class="lnk small" data-sb="sheets" data-path="${esc(pages[0])}" target="_blank" rel="noopener">فتح الورقة في نافذة مستقلة</a>`;
}
window.sheetImgFail = (im) => {
  if (!im.getAttribute("src")) return;
  if (!im.dataset.tried) { im.dataset.tried = "1"; Store.hydrate(im.parentNode, true); return; }
  im.replaceWith(Object.assign(document.createElement("p"), { className: "note warn", textContent: "تعذّر عرض صورة الورقة على هذا الجهاز. جرّبي «فتح الورقة في نافذة مستقلة» أو اطلبيها من المعلمة." }));
};
""")
sub("""  const up = Store.assets ? `<label class="btn ghost sm">${mine ? "استبدال صورة الورقة" : "إرفاق صورة ورقة الإجابة"}<input type="file" accept="image/*" hidden data-chg="sheetUp" data-s="${sid}" data-t="${t.id}"></label>` : "";""",
    """  const up = `<label class="btn ghost sm">${mine && !String(mine).startsWith("legacy:") ? "استبدال صورة الورقة" : "إرفاق صورة ورقة الإجابة"}<input type="file" accept="image/*,application/pdf" hidden data-chg="sheetUp" data-s="${sid}" data-t="${t.id}"></label>`;""")
sub("""    if (!Store.assets) throw { message: "رفع الصور غير متاح في هذا العرض." };
    toast("جارٍ رفع صورة الورقة…"); const r = await Store.assets.upload(f);
    S.sheets[tid] = S.sheets[tid] || {}; S.sheets[tid][sid] = r.id; await save.sheets(tid);""",
    """    toast("جارٍ رفع صورة الورقة…");
    const pages = await Store.uploadSheet(await fileToImages(f), sid, el.dataset.k || tid);
    const key = el.dataset.k || tid;
    S.sheets[key] = S.sheets[key] || {}; S.sheets[key][sid] = pages[0]; S.sheetPages = S.sheetPages || {}; S.sheetPages[pages[0]] = pages; await save.sheets(key);""")
sub("""for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {""", """for (let p = 1; p <= Math.min(pdf.numPages, 12); p++) {""")

# 9. performance-task work: the original file goes to private storage; the AI evaluation runs on the server
sub("""    let aid = ""; try { const as = await claude.use("assets"); if (as && f.size <= 20 * 1048576) aid = (await as.upload(f)).id; } catch (e) { /* keeping the original is optional */ }
    const sub = { at: new Date().toISOString(), kind, name: f.name, size: f.size, note: note.trim(), th, aid, dur: Math.round(dur) };
    let ev = null;
    if (Store.sample) { say(`${IC.ai} يقيّم الذكاء الاصطناعي عملك حسب بنود التقييم…`); const blobs = []; for (const cv of frames) blobs.push(await toBlob(cv, 0.82)); ev = await evalTask(task, blobs, kind, note.trim(), dur); }
    await markSent(sid, t.id, (o) => { o.task = Object.assign({}, o.task, { sub, ev, tg: null }); });
    render();""",
    """    say("جارٍ رفع عملك…");
    let path = ""; try { if (f.size <= 50 * 1048576) path = await Store.uploadSubmission(f, sid, t.id); } catch (e) { /* the frames are enough for the evaluation */ }
    const sub = { at: new Date().toISOString(), kind, name: f.name, size: f.size, note: note.trim(), th, path, dur: Math.round(dur) };
    say(`${IC.ai} يقيّم الذكاء الاصطناعي عملك حسب بنود التقييم…`);
    const blobs = []; for (const cv of frames) blobs.push(await toBlob(cv, 0.82));
    const ev = await Store.submitTask({ sid, tid: t.id, taskId: task.id, sub, frames: blobs, kind, note: note.trim(), dur });
    S.acks[sid] = S.acks[sid] || { id: sid, seen: {}, notes: [] }; const o = ((S.acks[sid].sent = S.acks[sid].sent || {})[t.id] = S.acks[sid].sent[t.id] || {}); o.task = Object.assign({}, o.task, { sub, ev, tg: null });
    render();""")
sub("""${sub.aid ? ` · <a class="lnk" href="/_blob/${esc(sub.aid)}" target="_blank" rel="noopener">الملف الأصلي</a>` : ""}""",
    """${sub.path ? ` · <a class="lnk" data-sb="submissions" data-path="${esc(sub.path)}" target="_blank" rel="noopener">الملف الأصلي</a>` : ""}""")
sub("""<button class="btn" data-act="taskSubmit" data-s="${sid}" data-t="${t.id}">تسليم المهمة${Store.sample ? " وتقييمها" : ""}</button>""",
    """<button class="btn" data-act="taskSubmit" data-s="${sid}" data-t="${t.id}">تسليم المهمة وتقييمها</button>""")

# 10. teacher settings page: password and two-step verification instead of the local PIN
sub("""<button type="button" class="btn ghost" data-act="tpChange">تغيير الرقم السري للمعلمة</button>""",
    """<button type="button" class="btn ghost" data-act="tpChange">تغيير كلمة المرور</button>${Store.mfaOn ? `<button type="button" class="btn ghost" data-act="mfaOff">إلغاء التحقق بخطوتين</button>` : `<button type="button" class="btn ghost" data-act="mfaSetup">تفعيل التحقق بخطوتين</button>`}""")
sub("""<p class="muted">ملف واحد فيه الطالبات والمهارات وبنك الأسئلة والاختبارات ونتائجها واختبارات التحسين وما أُرسل لكل طالبة. احفظيه نسخة احتياطية، أو استخدميه لنقل المنصة إلى موقع مستقل. لا يحوي رقمك السري.</p>""",
    """<p class="muted">ملف واحد فيه الطالبات والمهارات وبنك الأسئلة والاختبارات ونتائجها واختبارات التحسين وما أُرسل لكل طالبة. احفظيه نسخة احتياطية في مكان آمن. لا يحوي كلمة مرورك ولا أرقام الهوية.</p>""")
sub("""const { auth, ...settings } = S.settings || {};""", """const settings = S.settings || {};""")
sub("""qimg: S.qimg || {}, behavior: S.behavior || null };""", """qimg: S.qimg || {}, behavior: S.behavior || null, stars: S.stars || null };""")

# 10b. one-time import of the old app's data file (first sign-in, or later from the school page)
sub("""<div class="row"><button class="btn" data-act="exportAll">تنزيل نسخة البيانات (JSON)</button></div></section>""",
    """<div class="row"><button class="btn" data-act="exportAll">تنزيل نسخة البيانات (JSON)</button><button class="btn ghost" data-act="importOpen">استيراد ملف بيانات المنصة السابقة</button></div></section>""")
sub("""A.logoRm = () =>""", """A.importOpen = (first) => modal(`<h3>${first === true ? "مرحبًا بك في إتقان" : "استيراد ملف البيانات"}</h3><p>${first === true ? "هذه أول مرة تدخلين. " : ""}اختاري ملف <b dir="ltr">itqan-data-….json</b> الذي نزّلتِه من زر «تنزيل نسخة البيانات» في المنصة السابقة. تُنقل البيانات كلها، ويُحوَّل رقم الهوية إلى بصمة مشفّرة ولا يُحفظ. يمكن تكرار الاستيراد دون أن يتكرر شيء.</p><label class="btn">اختيار الملف<input type="file" accept="application/json,.json" hidden data-chg="importFile"></label><div id="impRep"></div>`, true);
A.importDone = () => guard(async () => { A.close(); S.loaded = false; render(); await loadAll(); render(); });
A.logoRm = () =>""")
sub("""  aiKind: (el) => { S.ui.aiKind = el.value; },
  qImg:""", """  aiKind: (el) => { S.ui.aiKind = el.value; },
  importFile: (el) => guard(async () => {
    const f = el.files[0]; if (!f) return; const out = $("#impRep");
    out.innerHTML = `<p class="note">جارٍ نقل البيانات… قد يستغرق ذلك دقيقة.</p>`;
    const r = await Store.importFile(f);
    const lab = { students: "الطالبات", classes: "الفصول", skills: "المهارات", questions: "بنك الأسئلة", tests: "الاختبارات", test_results: "نتائج الاختبارات", improvement_rounds: "اختبارات التحسين", improvement_items: "أسئلة التحسين لكل طالبة", sheets: "أوراق الإجابة", acks: "تأكيدات الاطلاع", notes: "الملاحظات", behavior_events: "السلوك", perf_tasks: "المهام الأدائية" };
    out.innerHTML = `<p class="note ${r.same ? "ok" : "bad"}"><b>${r.same ? "اكتمل النقل، والأرقام مطابقة للملف." : "اكتمل النقل، لكن الفحص وجد اختلافًا. لا تعتمدي على الموقع قبل مراجعته."}</b></p>
      <div class="scroll"><table class="tbl"><thead><tr><th>البيانات</th><th>في الملف</th><th>في المنصة</th></tr></thead><tbody>${r.counts.filter((c) => lab[c.table]).map((c) => `<tr><td>${lab[c.table]}</td><td class="num">${c.file}</td><td class="num">${c.db ?? "—"}</td></tr>`).join("")}</tbody></table></div>
      <h4>فحص 3 طالبات (الدرجة قبل النقل وبعده)</h4><ul>${r.checks.map((c) => `<li><span dir="ltr">${esc(c.sid)}</span>: ${esc(c.file)} ← ${esc(c.db)} ${c.same ? "✓" : "✗"}</li>`).join("")}</ul>
      ${(r.warnings || []).length ? `<p class="muted small">${r.warnings.length} ملاحظة: بعض الملفات (مثل أوراق الإجابة) تحتاج رفعًا من جديد.</p>` : ""}
      <div class="row end"><button class="btn" data-act="importDone">فتح المنصة</button></div>`;
  }),
  qImg:""")

# 11. forms added by the port
sub("""  if (f.id === "tpForm") return teacherPw(f.dataset.mode);""", """  if (f.id === "tpForm") return teacherPw(f.dataset.mode);
  if (f.id === "pinForm") return guard(async () => { const v = $("#pinV").value.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\\D/g, ""); if (v.length < 8) throw { message: "رقم الهوية 10 خانات." }; await Store.setPins([{ id: f.dataset.id, nid: v }]); const s = stu(f.dataset.id); if (s) s.hasPin = true; A.close(); render(); }, "حُفظ الرقم السري مشفّرًا.");""")

# 12. no local-only debug switches, no self test; start is driven by boot()
cut(r"^\(async function start\(\) \{", r"^\}\)\(\);", """(async function start() {
  try { S.lang = localStorage.getItem("itqan:lang") === "en" ? "en" : "ar"; } catch (e) { /* default */ }
  if (/lang=en/.test(location.search)) S.lang = "en";
  S.loaded = false; render();
  const who = await Store.whoAmI().catch(() => null);
  S.pub = await Store.publicStats().catch(() => null);
  if (who && who.role) { S.role = who.role; S.sid = who.sid || null; await loadAll(); } else { S.settings = Object.assign({}, DEF_SETTINGS, (S.pub && S.pub.settings) || {}); S.loaded = true; }
  render();
""")
cut(r"^async function selfTest\(\)", r"\Z", "")

# 13. every render: fill signed links for stored files, then translate if English is on
sub("""  v.innerHTML = fn();""", """  v.innerHTML = fn();
  Store.hydrate(app);""")
sub("""function modal(html, wide) { $("#modal").innerHTML = `<div class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><button class="x" data-act="close" aria-label="إغلاق">×</button>${html}</div>`; $("#modal").classList.add("on"); applyLang($("#modal")); }""",
    """function modal(html, wide) { $("#modal").innerHTML = `<div class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><button class="x" data-act="close" aria-label="إغلاق">×</button>${html}</div>`; $("#modal").classList.add("on"); Store.hydrate($("#modal")); applyLang($("#modal")); }""")
sub("""  ${Store.mode === "local" && S.role === "teacher" ? `<div class="note">البيانات محفوظة على هذا المتصفح فقط.</div>` : ""}""",
    """  ${Store.offline ? `<div class="note warn">لا يوجد اتصال الآن. تُحفظ تعديلاتك على هذا الجهاز وتُرسل تلقائيًا عند عودة الاتصال.</div>` : ""}""")

# 13b. official class documents and bulk sheet upload on the improvement page
sub("""الأسئلة التي لم ترها الطالبة من قبل.</p></section>${body}`;""", """الأسئلة التي لم ترها الطالبة من قبل.</p></section>${list.length ? reportButtons(t) : ""}${body}`;""")

# 13c. keep the option each student chose (Excel / photographed sheets) for distractor analysis
sub("""S.ui.entry = { id: t.id, tab: Store.sample && Store.imgOK ? "ai" : "manual", draft: clone(t.results || {}) };""",
    """S.ui.entry = { id: t.id, tab: Store.sample && Store.imgOK ? "ai" : "manual", draft: clone(t.results || {}), ans: clone(t.answers || {}) };""")
sub("""      e.draft[st.id] = marks.map((m) => +m || 0); n++;""",
    """      e.draft[st.id] = marks.map((m) => +m || 0); n++;
      (e.ans = e.ans || {})[st.id] = qs.map((q, i) => (isAuto(q) && r[i + 1] !== "" && r[i + 1] != null ? String(r[i + 1]).trim() : null));""")
sub("""(e.ai || []).forEach((x) => { if (x.sid) { e.draft[x.sid] = x.marks.slice(); n++; } else skipped++; });""",
    """(e.ai || []).forEach((x) => { if (x.sid) { e.draft[x.sid] = x.marks.slice(); (e.ans = e.ans || {})[x.sid] = x.read.slice(); n++; } else skipped++; });""")
sub("""A.eSave = () => guard(async () => { const e = S.ui.entry, t = S.tests[e.id]; t.results = clone(e.draft);""",
    """A.eSave = () => guard(async () => { const e = S.ui.entry, t = S.tests[e.id]; t.results = clone(e.draft);
  { // a recorded option is kept only while it still agrees with the mark (the teacher may have corrected a cell)
    const ans = {}; Object.entries(e.ans || {}).forEach(([sid, a]) => { const r = t.results[sid]; if (!r || !a) return; const v = t.qs.map((q, i) => (isAuto(q) && a[i] != null && markOf(a[i], q) === (+r[i] || 0) ? a[i] : null)); if (v.some((x) => x != null)) ans[sid] = v; });
    if (Object.keys(ans).length) t.answers = ans; else delete t.answers;
  }""")

# 13d. question quality from earlier tests: chip on every question card, and the builder prefers proven questions
sub("""${q.src ? `<span class="muted">${esc(q.src)}${q.adapted ? " · مكيّف" : ""}</span>` : ""}${extra || ""}</footer></article>`;""",
    """${q.src ? `<span class="muted">${esc(q.src)}${q.adapted ? " · مكيّف" : ""}</span>` : ""}${qStatChip(q)}${extra || ""}</footer></article>`;""")
sub("""<button class="btn ghost" data-act="bAuto">اختيار تلقائي متوازن على المهارات</button>""",
    """<label class="chk"><input type="checkbox" data-chg="bPref" ${S.ui.bPref === false ? "" : "checked"}> تفضيل الأسئلة ذات الجودة المثبتة</label><button class="btn ghost" data-act="bAuto">اختيار تلقائي متوازن على المهارات</button>""")
sub("""    const bySkill = {}; pool.forEach((q) => (bySkill[q.skill] = bySkill[q.skill] || []).push(q));""",
    """    const bySkill = {}; pool.forEach((q) => (bySkill[q.skill] = bySkill[q.skill] || []).push(q));
    if (S.ui.bPref !== false) { const bs = bankQuality(); Object.values(bySkill).forEach((l) => l.sort((a, b) => qualityRank(bs[a.id]) - qualityRank(bs[b.id]))); }""")

# 14. the new "quality & accreditation" page (src/engine/ext/*.js run inside boot, after the original code)
sub("""portal: vPortal }[r] || vHome;""", """portal: vPortal, quality: vQuality, tasks: vTasksM }[r] || vHome;""")
# 16. the teacher's AI assistant on the analysis page, right after the decision summary
sub("""  ${decisionCard(t, g)}""", """  ${decisionCard(t, g)}${coachCard(t, g)}""")
# 15. performance tasks until mastery: on the student's own page and in the teacher's report
sub("""${ewStudentCard(S.sid)}<section class="card">""", """${ewStudentCard(S.sid)}${setTasksStudent(S.sid)}<section class="card">""")
sub("""${ewStudentCard(S.sid)}${behCard(S.sid)}""", """${ewStudentCard(S.sid)}${setTasksStudent(S.sid)}${behCard(S.sid)}""")
sub("""${taskTeacher(sid, t)}""", """${taskTeacher(sid, t)}${setTasksMini(sid)}""")

# 17. phase 2: school staff sign in with the same e-mail form, and leave with the same button
sub("""      if (r && r.setup) { S.role = "teacher"; A.importOpen(true); return; }""",
    """      if (r && r.setup) { S.role = "teacher"; A.importOpen(true); return; }
      if (r && r.staff) { A.close(); S.role = "staff"; S.staffAs = r.staff; S.ui.stTab = null; S.loaded = false; render(); await loadAll(); render(); return; }""")
sub("""S.role = null; S.sid = null; S.peek = false; S.ui = {};""", """S.role = null; S.sid = null; S.peek = false; S.ui = {}; S.staff = null; S.staffAs = null; S.teachers = null; S.members = null;""")
import glob, os
# libraries are served by the site itself (works offline-tolerant, no third-party script host)
code = code.replace("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/", "/vendor/")
ext = "\n".join(open(f, encoding="utf-8").read() for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "src", "engine", "ext", "*.js"))))
code = code + "\n" + ext

out = f"""// @ts-nocheck
/* eslint-disable */
/**
 * Itqan UI engine — generated by scripts/port-engine.py from the original single-file app.
 * Do not edit by hand: change the port script (or the original) and regenerate, so the port stays traceable.
 */
import {{ itemAnalysis, blueprint, trends, alphaBand, distractors, bankStats, qualityRank }} from "@/lib/calc/items";
export function boot(Store) {{
  if (window.__itqanBooted) return; window.__itqanBooted = true;
  const DATA = {{ skills: [], bank: [], logos: {{}}, qimg: {{}} }};
{code}
  window.__itqan = {{ S, render, A, evalTask }};
}}
"""
open("src/engine/itqan.js", "w", encoding="utf-8").write(out)
print("src/engine/itqan.js written:", len(out.splitlines()), "lines")

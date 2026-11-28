/* ===== Phase 2: the school's page and the school staff (principal, deputies, counselor) =====
 * The landing page becomes the school's page: one card per member of the school community.
 * Staff dashboards are read-only. The database decides what each role may read (Row Level Security):
 * only teachers who joined the school, and only the areas of that role. */
const SROLE = {
  principal: { t: "مديرة المدرسة", d: "صورة شاملة للمدرسة: الإتقان، والمعلمات، والإنذار المبكر، والسلوك، وأولياء الأمور.", tabs: ["overview", "academic", "warning", "behavior", "parents", "staff"] },
  academic_deputy: { t: "الوكيلة التعليمية", d: "نتائج الاختبارات، والمهارات الأضعف، واختبارات التحسين، والإنذار المبكر.", tabs: ["overview", "academic", "warning", "parents"] },
  student_deputy: { t: "الوكيلة الطلابية", d: "السلوك والانضباط، والتواصل مع أولياء الأمور، ورموز دخولهم.", tabs: ["overview", "behavior", "parents"] },
  counselor: { t: "الموجهة الطلابية", d: "الطالبات اللاتي يحتجن متابعة، وأسباب ذلك، والسلوك، وتواصل أولياء الأمور.", tabs: ["overview", "warning", "behavior", "parents"] },
};
const STAB = { overview: "نظرة عامة", academic: "التحصيل والإتقان", warning: "الإنذار المبكر", behavior: "السلوك", parents: "أولياء الأمور", staff: "منسوبات المدرسة" };
const SICON = {
  teacher: '<path d="M4 19V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 1 2-2h12"/><path d="M9 8h6M9 11h4"/>',
  student: '<path d="M12 4 2 9l10 5 10-5-10-5Z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  parent: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M2.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M14 19c.4-2.4 1.6-3.8 3-3.8s2.9 1.4 3.4 3.8"/>',
  principal: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M10 21v-5h4v5M9 12h.01M15 12h.01"/>',
  academic_deputy: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  student_deputy: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  counselor: '<path d="M20 12a8 8 0 1 1-3.2-6.4"/><path d="M12 8v4l3 2"/><path d="M20 4v4h-4"/>',
};
const sico = (k) => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SICON[k]}</svg>`;

/* ---------- the school's page (landing) ---------- */
renderLanding = function () {
  const s = S.settings, card = (k, t, d, act) => `<button class="sp-role" data-act="${act}" data-r="${k}"><i>${sico(k)}</i><b>${t}</b><span>${d}</span></button>`;
  app.innerHTML = `<div class="sp">
    <header class="sp-top"><div class="sp-brand"><span class="mark">✓</span><div><b>إتقان</b><span>منصة إتقان المهارات</span></div></div><button class="btn ghost sm" data-act="lang">${S.lang === "en" ? "العربية" : "English"}</button></header>
    <section class="sp-hero">
      <div class="sp-school">${s.logo ? `<img class="slogo" src="${esc(s.logo)}" alt="">` : ""}<div><small>صفحة المدرسة</small><h1 data-keep>${esc(s.school || "مدرستي")}</h1>${s.region ? `<span data-keep>${esc(s.region)}</span>` : ""}</div></div>
      <p class="lead">التقويم لا يكتمل عند الدرجة… بل عند الإتقان</p>
      <p class="loopline"><b>حلقة تبدأ بالتشخيص… ولا تنتهي إلا بالإتقان</b><span>نقيس • نحلّل • نعالج • نعيد التقويم</span></p>
    </section>
    <section class="sp-sec"><h2>الدخول إلى المنصة</h2><p class="muted">اختاري صفتك في المدرسة.</p>
      <div class="sp-roles">
        ${card("teacher", "المعلمات", "المهارات، بنك الأسئلة، الاختبارات، التصحيح، التحليل، واختبارات التحسين.", "asTeacher")}
        ${card("student", "الطالبة", "تقرير مهاراتي، واختباراتي، ومهامي الأدائية.", "spPin")}
        ${card("parent", "وليّ الأمر", "متابعة ابنتك أو بناتك برمز وليّ الأمر.", "spPin")}
        ${card("principal", "مديرة المدرسة", SROLE.principal.d, "spStaff")}
        ${card("academic_deputy", "الوكيلة التعليمية", SROLE.academic_deputy.d, "spStaff")}
        ${card("student_deputy", "الوكيلة الطلابية", SROLE.student_deputy.d, "spStaff")}
        ${card("counselor", "الموجهة الطلابية", SROLE.counselor.d, "spStaff")}
      </div>
      <form class="door sp-pin" id="loginForm"><b>دخول الطالبة ووليّ الأمر</b><span>أدخلي الرقم السري (أو رمز وليّ الأمر) لعرض تقرير المهارات.</span>
        <div class="row"><input id="nid" type="password" inputmode="numeric" autocomplete="off" placeholder="الرقم السري" aria-label="الرقم السري"><button class="btn" type="submit">دخول</button></div>
        <small id="loginErr" class="err"></small></form>
    </section>
    <section class="sp-sec"><h2>كيف تعمل إتقان</h2>
      <div class="hook"><b>طالبتان… الدرجة نفسها 14 من 20… والفجوة مختلفة.</b><span>الدرجة الكلية تُخفي المهارة الناقصة، فيُعاد الشرح للجميع ويضيع الجهد.</span></div>
      <ol class="hsteps"><li><b>يربط</b><span>كل سؤال بمهارته ومستواه المعرفي</span></li><li><b>يشخّص</b><span>فجوة كل طالبة عن الإتقان</span></li><li><b>يقرّر</b><span>علاج أو دعم أو إثراء</span></li><li><b>يعيد التقويم</b><span>في مهاراتها الناقصة وحدها</span></li></ol>
    </section>
    <footer class="sp-foot">إتقان · itqanloop.com · بيانات الطالبات محفوظة ومشفّرة، ولا يرى كل دور إلا ما يخصه.</footer>
  </div>`;
  document.body.classList.remove("priv"); applyLang(app);
};
A.spPin = (el) => { const i = $("#nid"); if (!i) return; i.placeholder = el.dataset.r === "parent" ? "رمز وليّ الأمر" : "الرقم السري"; i.closest("form").scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => i.focus(), 300); };
A.spStaff = (el) => {
  const r = el.dataset.r, t = SROLE[r].t;
  if (Store.demoStaff) return guard(async () => { S.role = "staff"; S.staffAs = r; S.ui.stTab = SROLE[r].tabs[0]; S.loaded = false; render(); await loadAll(); render(); window.scrollTo(0, 0); });
  modal(`<h3>دخول ${t}</h3><p class="muted">بالبريد الإلكتروني وكلمة المرور اللذين وصلا في دعوة المديرة.</p><form id="tpForm" data-mode="enter"><label class="fld">البريد الإلكتروني<input id="tpE" type="email" autocomplete="username" dir="ltr" required></label><label class="fld">كلمة المرور<input id="tp1" type="password" autocomplete="current-password" required></label><small id="tpErr" class="err"></small><div class="row end"><button class="lnk" type="button" data-act="tpForgot">نسيت كلمة المرور</button><button class="btn" type="submit">دخول</button></div></form>`);
};

/* ---------- staff dashboards (read-only) ---------- */
const _render0 = render;
render = function () {
  if (S.loaded && S.role === "staff") return renderStaff();
  document.body.classList.remove("staff");
  return _render0();
};
const staffRole = () => (S.staff && S.staff.role) || S.staffAs || "principal";
const sd = (xs) => { if (!xs.length) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length); };
const tName = (id) => ((S.teachers || []).find((t) => t.id === id) || {}).name || S.settings.teacher || "";
function renderStaff() {
  const s = S.settings, role = staffRole(), R = SROLE[role] || SROLE.principal, tab = R.tabs.includes(S.ui.stTab) ? S.ui.stTab : R.tabs[0];
  const logo = s.logo ? `<img class="slogo" src="${esc(s.logo)}" alt="">` : `<span class="mark">✓</span>`;
  app.innerHTML = `
  <header class="top"><div class="brand">${logo}<div><b>إتقان</b><span data-keep>${esc(s.school)}</span></div></div>
    <div class="who"><span>${R.t}</span><button class="btn sm ${S.ui.reveal ? "" : "ghost"}" data-act="reveal" aria-pressed="${S.ui.reveal ? "true" : "false"}">${EYE} ${S.ui.reveal ? "إخفاء الأسماء" : "إظهار الأسماء"}</button><button class="btn ghost sm" data-act="lang">${S.lang === "en" ? "العربية" : "English"}</button><button class="btn ghost sm" data-act="logout">خروج</button></div></header>
  <nav class="tabs" aria-label="أقسام لوحة ${R.t}">${R.tabs.map((k) => `<a href="#" data-act="stTab" data-k="${k}" class="${tab === k ? "on" : ""}">${STAB[k]}</a>`).join("")}</nav>
  ${S.loadError ? `<div class="note bad">${esc(S.loadError)}</div>` : ""}
  ${Store.demoStaff ? `<div class="note demo"><span><b>نسخة تجريبية.</b> تعرض اللوحة بيانات معلمة واحدة انضمت إلى المدرسة. في الموقع الحقيقي تظهر هنا كل معلمة تنضم.</span></div>` : ""}
  <div class="note">لوحة للاطلاع فقط: لا تغيّر الدرجات ولا بيانات المعلمات. ولا تظهر فيها إلا بيانات المعلمات اللاتي انضممن إلى المدرسة.</div>
  <main id="view">${({ overview: stOverview, academic: stAcademic, warning: stWarning, behavior: stBehavior, parents: stParents, staff: stStaff }[tab])()}</main>`;
  document.body.classList.toggle("priv", !S.ui.reveal);
  document.body.classList.add("staff");
  applyLang(app);
}
A.stTab = (el) => { S.ui.stTab = el.dataset.k; render(); window.scrollTo(0, 0); };

const doneTests = () => testsSorted().filter((t) => t.results && Object.keys(t.results).length);
const latestByTeacher = () => { const seen = new Set(); return doneTests().filter((t) => { const k = t._teacher || "me"; if (seen.has(k)) return false; seen.add(k); return true; }); };
function testRow(t) {
  const g = groupStats(t), tot = testMax(t), xs = g.students.map((x) => pct(x.score, tot)), x0 = g.students.map((x) => pct(x.base, tot));
  return { t, g, n: g.n, before: g.n ? pct(g.mean0, tot) : 0, after: g.n ? pct(g.mean, tot) : 0, sd: sd(xs), sd0: sd(x0), mastered: g.students.filter((x) => x.score / tot >= 0.8).length, low: g.low };
}
function stOverview() {
  const tests = latestByTeacher().map(testRow), all = S.roster.map((st) => risk(st.id, true)).filter(Boolean);
  const hi = all.filter((r) => r.level === "high").length, mid = all.filter((r) => r.level === "mid").length;
  const teachers = S.teachers && S.teachers.length ? S.teachers : [{ id: "me", name: s0().teacher, subject: s0().subject, grade: s0().grade }];
  const classes = [...new Set(S.roster.map((x) => x.cls))];
  const n = tests.reduce((a, r) => a + r.n, 0), w = (k) => (n ? Math.round((tests.reduce((a, r) => a + r[k] * r.n, 0) / n) * 10) / 10 : 0);
  return `<section class="card"><h2>${esc(S.settings.school)}</h2>
    <div class="grid4"><div class="tile"><b>${teachers.length}</b><span>معلمة منضمة</span></div><div class="tile"><b>${new Set(S.roster.map((x) => x.name)).size}</b><span>طالبة</span></div><div class="tile"><b>${classes.length}</b><span>فصلًا</span></div><div class="tile"><b>${doneTests().length}</b><span>اختبارًا مصحّحًا</span></div></div>
    <div class="grid4"><div class="tile"><b dir="ltr" style="font-size:1.45rem">${w("before")}% → ${w("after")}%</b><span>متوسط الإتقان قبل التحسين وبعده (آخر اختبار لكل معلمة)</span></div><div class="tile"><b>${hi}</b><span>طالبة في خطر مرتفع</span></div><div class="tile"><b>${mid}</b><span>تحتاج متابعة</span></div><div class="tile"><b>${ackRate()}%</b><span>اطلاع أولياء الأمور على آخر تقرير</span></div></div></section>
  <section class="card"><h2>المعلمات والمواد</h2><div class="scroll"><table class="tbl"><thead><tr><th>المعلمة</th><th>المادة</th><th>الصف</th><th>آخر اختبار</th><th>الطالبات</th><th>الإتقان قبل ← بعد</th><th>SD</th></tr></thead><tbody>
    ${teachers.map((tc) => { const r = tests.find((x) => (x.t._teacher || "me") === tc.id) || (tc.id === "me" ? tests[0] : null); return `<tr><td data-keep>${esc(tc.name)}</td><td>${esc(tc.subject)}</td><td>${esc(tc.grade || "")}</td><td>${r ? esc(r.t.name) : "—"}</td><td class="num">${r ? r.n : "—"}</td><td class="num"><bdi dir="ltr">${r ? `${r.before}% → ${r.after}%` : "—"}</bdi></td><td class="num">${r ? fmt(r.sd) : "—"}</td></tr>`; }).join("")}
  </tbody></table></div></section>`;
}
const s0 = () => S.settings;
function ackRate() {
  const t = doneTests()[0]; if (!t) return 0;
  const ids = Object.keys(t.results || {}); if (!ids.length) return 0;
  return Math.round((ids.filter((sid) => ((S.acks[sid] || {}).seen || {})[t.id]).length / ids.length) * 100);
}
function stAcademic() {
  const rows = doneTests().map(testRow);
  if (!rows.length) return `<section class="card"><h2>التحصيل والإتقان</h2><p class="muted">لا توجد اختبارات مصحّحة بعد.</p></section>`;
  const last = rows[0], g = last.g, L = { K: "المعرفة", A: "التطبيق", R: "الاستدلال" };
  const cls = [...new Set(S.roster.filter((x) => last.t.results[x.id]).map((x) => x.cls))];
  return `<section class="card"><h2>الاختبارات</h2><div class="scroll"><table class="tbl"><thead><tr><th>الاختبار</th><th>المعلمة</th><th>التاريخ</th><th>الطالبات</th><th>قبل التحسين</th><th>بعد التحسين</th><th>SD</th><th>أتقنّ (80%+)</th><th>أقل من 60%</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.t.name)}</td><td data-keep>${esc(tName(r.t._teacher))}</td><td class="num">${esc(r.t.date || "")}</td><td class="num">${r.n}</td><td class="num">${r.before}%</td><td class="num">${r.after}%</td><td class="num">${fmt(r.sd)}</td><td class="num">${r.mastered}</td><td class="num">${r.low}</td></tr>`).join("")}
  </tbody></table></div></section>
  <section class="card"><h2>${esc(last.t.name)}: حسب الفصل</h2><div class="scroll"><table class="tbl"><thead><tr><th>الفصل</th><th>الطالبات</th><th>قبل</th><th>بعد</th><th>أقل من 60%</th></tr></thead><tbody>
    ${cls.map((c) => { const x = groupStats(last.t, c), tot = testMax(last.t); return `<tr><td>${esc(c)}</td><td class="num">${x.n}</td><td class="num">${pct(x.mean0, tot)}%</td><td class="num">${pct(x.mean, tot)}%</td><td class="num">${x.low}</td></tr>`; }).join("")}
  </tbody></table></div>
  <h3>حسب المستوى المعرفي</h3><div class="grid4">${Object.entries(g.levels).filter(([, v]) => v.t).map(([k, v]) => `<div class="tile"><b dir="ltr">${pct(v.c0, v.t)}% → ${pct(v.c, v.t)}%</b><span>${L[k]}</span></div>`).join("")}</div>
  <h3>المهارات الأضعف</h3><ul class="ew">${g.skills.slice(0, 6).map((o) => `<li class="${o.pct < 50 ? "high" : o.pct < 65 ? "mid" : "ok"}"><div><strong>${esc((sk(o.id) || {}).name || o.id)}</strong><span>الإتقان ${o.pct0}% ← ${o.pct}% بعد التحسين · ${o.low} طالبة أقل من 50%</span></div></li>`).join("")}</ul></section>`;
}
function stWarning() {
  const all = S.roster.map((st) => risk(st.id, true)).filter(Boolean), show = all.filter((r) => r.level !== "ok").sort((a, b) => b.pts - a.pts);
  return `<section class="card ewcard"><div class="hd"><h2>الإنذار المبكر قبل التعثر</h2><div class="legend"><span><i class="sq low"></i>${all.filter((r) => r.level === "high").length} خطر مرتفع</span><span><i class="sq mid"></i>${all.filter((r) => r.level === "mid").length} تحتاج متابعة</span><span><i class="sq high"></i>${all.filter((r) => r.level === "ok").length} مطمئنة</span></div></div>
    ${show.length ? `<ul class="ew">${show.slice(0, S.ui.ewAll ? 999 : 15).map((r) => { const st = stu(r.sid); return `<li class="${r.level}"><div><strong>${nm(st)} <small class="muted">${esc(st.cls)}${S.teachers ? " · " + esc(tName(st._teacher)) : ""}</small></strong><span>${r.why.map(esc).join(" · ")}</span></div></li>`; }).join("")}</ul>${show.length > 15 && !S.ui.ewAll ? `<button class="lnk" data-act="ewAll">عرض الكل (${show.length})</button>` : ""}` : `<p class="note ok">لا توجد طالبة في دائرة الخطر حاليًا.</p>`}
    <p class="muted">المؤشر نفسه الذي تراه المعلمة: الإتقان في آخر اختبار، والمهارات الأقل من ${EW.low}%، والتراجع، والمخالفات خلال ${EW.behDays} يومًا، ومتابعة وليّ الأمر.</p></section>`;
}
function stBehavior() {
  const from = new Date(Date.now() - EW.behDays * 864e5).toISOString().slice(0, 10), rec = S.behavior.filter((b) => b.date >= from);
  const neg = rec.filter(isNeg), pos = rec.filter((b) => !isNeg(b)), by = {};
  neg.forEach((b) => (by[b.sid] = (by[b.sid] || 0) + 1));
  const types = {}; rec.forEach((b) => { const k = (isNeg(b) ? "− " : "+ ") + (b.type || "أخرى"); types[k] = (types[k] || 0) + 1; });
  const many = Object.entries(by).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  return `<section class="card"><h2>السلوك خلال ${EW.behDays} يومًا</h2>
    <div class="grid4"><div class="tile"><b>${pos.length}</b><span>سلوكًا إيجابيًا</span></div><div class="tile"><b>${neg.length}</b><span>مخالفة</span></div><div class="tile"><b>${many.length}</b><span>طالبة بمخالفتين أو أكثر</span></div></div>
    ${Object.keys(types).length ? `<h3>الأنواع</h3><div class="scroll"><table class="tbl"><tbody>${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="num">${n}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">لا توجد ملاحظات سلوكية مسجلة في هذه المدة.</p>`}
    ${many.length ? `<h3>تحتاج متابعة سلوكية</h3><ul class="ew">${many.map(([sid, n]) => { const st = stu(sid); return st ? `<li class="${n >= EW.behMany ? "high" : "mid"}"><div><strong>${nm(st)} <small class="muted">${esc(st.cls)}</small></strong><span>${n} مخالفات</span></div></li>` : ""; }).join("")}</ul>` : ""}</section>`;
}
function stParents() {
  const t = doneTests()[0], ids = t ? Object.keys(t.results || {}) : [], not = ids.filter((sid) => !((S.acks[sid] || {}).seen || {})[t.id]);
  const canCodes = ["principal", "student_deputy"].includes(staffRole());
  return `<section class="card"><h2>أولياء الأمور</h2>
    ${t ? `<div class="grid4"><div class="tile"><b>${ackRate()}%</b><span>اطّلعوا على تقرير ${esc(t.name)}</span></div><div class="tile"><b>${not.length}</b><span>لم يطّلعوا بعد</span></div></div>
    ${not.length ? `<details class="sheet"><summary>من لم يطّلع وليّ أمرها (${not.length})</summary><ul class="plain">${not.map((sid) => { const st = stu(sid); return st ? `<li>${nm(st)} <small class="muted">${esc(st.cls)}</small></li>` : ""; }).join("")}</ul></details>` : ""}` : `<p class="muted">يظهر هنا اطلاع أولياء الأمور بعد أول تقرير.</p>`}</section>
  ${canCodes ? `<section class="card"><h2>رموز دخول أولياء الأمور</h2><p>لكل وليّ أمر رمز خاص من 8 أرقام، يدخل به من صفحة المدرسة ويتابع به أكثر من بنت. يُحفظ الرمز مشفّرًا، فلا يظهر إلا مرة واحدة عند إصداره: اطبعيه وسلّميه لوليّ الأمر.</p>
    <div class="row wrap"><label class="fld">الفصل<select id="pcCls"><option value="">كل الفصول</option>${[...new Set(S.roster.map((x) => x.cls))].map((c) => `<option>${esc(c)}</option>`).join("")}</select></label><button class="btn" data-act="stCodes">إصدار الرموز</button></div></section>` : ""}`;
}
A.stCodes = () => guard(async () => {
  const c = ($("#pcCls") || {}).value || "", list = S.roster.filter((x) => !c || x.cls === c);
  const r = Store.parentCodes ? await Store.parentCodes(list.map((x) => x.id)) : { codes: {} };
  const rows = list.filter((x) => r.codes[x.id]);
  modal(`<h3>رموز أولياء الأمور${c ? " · " + esc(c) : ""}</h3><p class="muted">تظهر هذه الرموز الآن فقط. اطبعيها وسلّمي كل وليّ أمر رمزه.${Store.demoStaff ? " (رموز تجريبية للعرض)" : ""}</p>
    <div class="scroll"><table class="tbl" id="pcTbl"><thead><tr><th>الطالبة</th><th>الفصل</th><th>رمز وليّ الأمر</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${nm(x)}</td><td>${esc(x.cls)}</td><td class="num" dir="ltr">${esc(r.codes[x.id])}</td></tr>`).join("")}</tbody></table></div>
    ${r.missing && r.missing.length ? `<p class="note warn">${r.missing.length} طالبة بلا رقم سري بعد، فلم يصدر لها رمز.</p>` : ""}
    <div class="row end"><button class="btn ghost" data-act="close">إغلاق</button><button class="btn" data-act="stCodesPrint">طباعة</button></div>`, true);
});
A.stCodesPrint = () => { const t = $("#pcTbl"); if (!t) return; const w = window.open("", "_blank"); if (!w) return toast("اسمحي بفتح النوافذ للطباعة."); w.document.write(`<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><title>رموز أولياء الأمور</title><style>body{font-family:Tahoma,Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:8px;text-align:right}</style><h2>${esc(S.settings.school)} · رموز دخول أولياء الأمور إلى منصة إتقان</h2>${t.outerHTML.replace(/class="pii"/g, "")}</html>`); w.document.close(); w.print(); };

function stStaff() {
  if (!S.members && !S.membersBusy) {
    S.membersBusy = true;
    (Store.schoolMembers ? Store.schoolMembers() : Promise.resolve({ members: [] })).then((r) => { S.members = r.members || []; }).catch(() => { S.members = []; }).finally(() => { S.membersBusy = false; render(); });
  }
  const RL = { teacher: "معلمة", principal: "مديرة", academic_deputy: "وكيلة تعليمية", student_deputy: "وكيلة طلابية", counselor: "موجهة طلابية" };
  const ST = { active: ["منضمة", "ok"], invited: ["دُعيت ولم تقبل بعد", ""], requested: ["تطلب الانضمام", "warn"] };
  const m = S.members || [];
  return `<section class="card"><h2>منسوبات المدرسة</h2>
    ${!S.members ? `<p class="muted">جارٍ التحميل…</p>` : m.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>الاسم</th><th>الصفة</th><th>المادة</th><th>الحالة</th><th></th></tr></thead><tbody>${m.map((x) => `<tr><td data-keep>${esc(x.name || x.email || "")}</td><td>${RL[x.role] || x.role}</td><td>${esc(x.subject || "")}</td><td><span class="chip ${ST[x.status] ? ST[x.status][1] : ""}">${ST[x.status] ? ST[x.status][0] : esc(x.status)}</span></td><td>${x.status === "requested" ? `<button class="btn sm" data-act="stDecide" data-m="${esc(x.id)}" data-a="approve">قبول</button>` : ""}${x.role !== "principal" ? `<button class="lnk danger" data-act="stDecide" data-m="${esc(x.id)}" data-a="remove">إزالة</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">لا يوجد أعضاء بعد.</p>`}
    <p class="muted">المعلمة التي تنضم تنتقل بياناتها إلى المدرسة بموافقتها. والمعلمة التي تُزال تبقى لها بياناتها كاملة، ولا تراها المدرسة بعد ذلك.</p></section>
  <section class="card"><h2>دعوة عضو جديد</h2><p>تصلها رسالة على بريدها، تضع منها كلمة المرور ثم تدخل من صفحة المدرسة.</p>
    <div class="row wrap"><label class="fld grow">البريد الإلكتروني<input id="invE" type="email" dir="ltr" autocomplete="off"></label><label class="fld">الصفة<select id="invR"><option value="teacher">معلمة</option><option value="academic_deputy">وكيلة تعليمية</option><option value="student_deputy">وكيلة طلابية</option><option value="counselor">موجهة طلابية</option></select></label><button class="btn" data-act="stInvite">إرسال الدعوة</button></div></section>`;
}
A.stInvite = () => guard(async () => {
  const e = ($("#invE").value || "").trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw { message: "اكتبي بريدًا إلكترونيًا صحيحًا." };
  await Store.schoolInvite(e, $("#invR").value); S.members = null; render();
}, "أُرسلت الدعوة.");
A.stDecide = (el) => guard(async () => { await Store.schoolDecide(el.dataset.m, el.dataset.a); S.members = null; render(); }, "تم.");

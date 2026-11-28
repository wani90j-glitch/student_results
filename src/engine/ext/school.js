/* ===== Phase 2: the school's page and the school staff (principal, deputies, counselor) =====
 * The landing page becomes the school's page: one card per member of the school community.
 * Staff dashboards are read-only. The database decides what each role may read (Row Level Security):
 * only teachers who joined the school, and only the areas of that role. */
/** Arabic or English text for the new pages (the older pages use the EN dictionary). */
const T = (ar, en) => (S.lang === "en" ? en : ar);
const SROLE = {
  principal: { t: "مديرة المدرسة", te: "School principal", d: "صورة شاملة للمدرسة: الإتقان، والمعلمات، والإنذار المبكر، والسلوك، وأولياء الأمور.", de: "The whole school at a glance: mastery, teachers, early warning, behaviour and parents.", tabs: ["overview", "academic", "warning", "behavior", "parents", "staff"] },
  academic_deputy: { t: "الوكيلة التعليمية", te: "Academic deputy", d: "نتائج الاختبارات، والمهارات الأضعف، واختبارات التحسين، والإنذار المبكر.", de: "Test results, weakest skills, improvement tests and early warning.", tabs: ["overview", "academic", "warning", "parents"] },
  student_deputy: { t: "الوكيلة الطلابية", te: "Student affairs deputy", d: "السلوك والانضباط، والتواصل مع أولياء الأمور، ورموز دخولهم.", de: "Behaviour and discipline, contact with parents, and their sign-in codes.", tabs: ["overview", "behavior", "parents"] },
  counselor: { t: "الموجهة الطلابية", te: "Student counsellor", d: "الطالبات اللاتي يحتجن متابعة، وأسباب ذلك، والسلوك، وتواصل أولياء الأمور.", de: "Students who need follow-up and why, behaviour, and parents' contact.", tabs: ["overview", "warning", "behavior", "parents"] },
};
const STAB = { overview: ["نظرة عامة", "Overview"], academic: ["التحصيل والإتقان", "Achievement and mastery"], warning: ["الإنذار المبكر", "Early warning"], behavior: ["السلوك", "Behaviour"], parents: ["أولياء الأمور", "Parents"], staff: ["منسوبات المدرسة", "School staff"] };
const rT = (R) => T(R.t, R.te), rD = (R) => T(R.d, R.de), tabT = (k) => T(STAB[k][0], STAB[k][1]);
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

/* ---------- the school's page (landing): white top bar, hero over soft green waves, figures, award, footer wave ---------- */
const AWARD_IMG = "/awards/saif-silver.webp";
const MXI = {
  school: SICON.principal, teacher: SICON.teacher, student: SICON.student,
  bank: '<path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3V5Z"/><path d="M8 9h6M8 12h6M8 15h3"/>',
  test: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10l2 2 4-4M9 16h6"/>',
  improve: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/><path d="m9 12 2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
};
const mxico = (k, n = 26) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MXI[k] || SICON[k]}</svg>`;
const mxNum = (n) => (n >= 1e6 ? (Math.round(n / 1e5) / 10) + "M" : n >= 1e4 ? (Math.round(n / 100) / 10) + "K" : String(n));
/** Itqan's own artwork: the mastery loop (measure → analyse → treat → re-assess) around a skills map. */
const MX_ART = () => {
  const cells = [3, 3, 2, 3, 1, 2, 3, 2, 3, 3, 1, 3, 2, 3, 3, 2, 3, 1, 3, 3, 2, 3, 3, 3, 3]; // 1 low · 2 mid · 3 mastered
  const col = { 1: "#e8a493", 2: "#f0cf7a", 3: "#7fc4a8" };
  const grid = cells.map((v, i) => `<rect x="${172 + (i % 5) * 24}" y="${172 + Math.floor(i / 5) * 24}" width="18" height="18" rx="4" fill="${col[v]}"/>`).join("");
  const node = (x, y, t, n) => { const w = t.split(" "), lines = w.map((v, k) => `<text x="${x}" y="${y + 6 + (k - (w.length - 1) / 2) * 20}" text-anchor="middle" font-size="${w.length > 1 ? 15 : 17}" font-weight="700" fill="#0e3f3c">${v}</text>`).join("");
    return `<g><circle cx="${x}" cy="${y}" r="44" fill="#fff" stroke="#0e3f3c" stroke-width="2.5"/>${lines}<circle cx="${x + 32}" cy="${y - 32}" r="13" fill="#c9962b"/><text x="${x + 32}" y="${y - 27}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${n}</text></g>`; };
  return `<svg class="mx-art" viewBox="0 0 480 480" role="img" aria-label="${T("حلقة الإتقان: نقيس، نحلّل، نعالج، نعيد التقويم", "The mastery loop: measure, analyse, treat, re-assess")}">
    <circle cx="240" cy="240" r="170" fill="none" stroke="#dbe6e1" stroke-width="16"/>
    <path d="M240 70A170 170 0 1 1 110 130" fill="none" stroke="#1f5e57" stroke-width="16" stroke-linecap="round"/>
    <path d="M98 150l16-30 20 24z" fill="#c9962b"/>
    <rect x="160" y="160" width="160" height="160" rx="18" fill="#fff" stroke="#dbe6e1" stroke-width="2"/>${grid}
    ${node(240, 70, T("نقيس", "Measure"), "1")}${node(410, 240, T("نحلّل", "Analyse"), "2")}${node(240, 410, T("نعالج", "Treat"), "3")}${node(70, 240, T("نعيد التقويم", "Re-assess"), "4")}
  </svg>`;
};
renderLanding = function () {
  const s = S.settings, card = (k, t, d, act) => `<button class="sp-role" data-act="${act}" data-r="${k}"><i>${sico(k)}</i><b>${t}</b><span>${d}</span></button>`;
  const c = (S.pub && S.pub.counts) || null;
  const figs = c ? [["school", c.schools, T("مدرسة", "schools")], ["teacher", c.teachers, T("معلمة", "teachers")], ["student", c.students, T("طالبة مستفيدة", "students served")], ["bank", c.questions, T("سؤالًا في بنوك المهارات", "questions in skill banks")], ["test", c.tests, T("اختبارًا مصحّحًا", "tests marked")], ["improve", c.improve, T("اختبار تحسين فردي", "individual improvement tests")]].filter((f) => f[1] > 0) : [];
  app.innerHTML = `<div class="sp mx">
    <header class="mx-nav">
      <div class="mx-logo"><span class="mark">✓</span><div><b>${T("إتقان", "Itqan")}</b><small dir="ltr">itqanloop</small></div></div>
      <nav class="mx-links" aria-label="${T("أقسام الصفحة", "Page sections")}"><button data-act="mxGo" data-to="mx-why">${T("عن إتقان", "About Itqan")}</button><button data-act="mxGo" data-to="mx-roles">${T("الدخول", "Sign in")}</button>${figs.length ? `<button data-act="mxGo" data-to="mx-num">${T("إتقان في أرقام", "Itqan in numbers")}</button>` : ""}<button data-act="mxGo" data-to="mx-awards">${T("الجوائز", "Awards")}</button></nav>
      <div class="mx-tools"><button class="mx-tool" data-act="lang">${S.lang === "en" ? "العربية" : "English"}</button><button class="mx-tool" data-act="mxGo" data-to="mx-roles">${mxico("user", 22)}<span>${T("تسجيل الدخول", "Sign in")}</span></button></div>
    </header>
    <section class="mx-hero">
      <div class="mx-hero-in">
        ${S.schoolPage ? `<span class="mx-chip">${S.schoolPage.logo ? `<img src="${esc(S.schoolPage.logo)}" alt="">` : ""}<span data-keep>${esc(S.schoolPage.name)}</span></span>` : ""}
        <h1>${T("التقويم لا يكتمل عند الدرجة… بل عند الإتقان", "Assessment isn't complete at the grade… only at mastery")}</h1>
        <p>${T("إتقان لا تعطي درجة فقط… بل تحوّلها إلى <b>خارطة طريق نحو الإتقان</b>.", "Itqan doesn't just give a grade… it turns it into a <b>roadmap to mastery</b>.")}<br><span>${T("نقيس • نحلّل • نعالج • نعيد التقويم", "Measure • Analyse • Treat • Re-assess")}</span></p>
        <button class="mx-btn" data-act="mxGo" data-to="mx-roles">${T("تسجيل الدخول", "Sign in")}</button>
      </div>
      <div class="mx-hero-art">${MX_ART()}</div>
    </section>
    <section class="mx-sec mx-why" id="mx-why"><h2>${T("من سباق على الدرجات… إلى رحلة نحو الإتقان", "From a race for grades… to a journey towards mastery")}</h2>
      <p class="mx-lead">${T("معظم المنصات تتوقف عند الدرجة. أما إتقان فتحدد <b>الفجوة</b> و<b>المهارات المفقودة</b> و<b>المستوى المعرفي</b>، ليُبنى عليها التقويم والعلاج.", "Most platforms stop at the grade. Itqan identifies the <b>gap</b>, the <b>missing skills</b> and the <b>cognitive level</b>, so that assessment and treatment are built on them.")}</p>
      <div class="mx-vs">
        <div class="mx-vs-a"><small>${T("المعتاد", "Usually")}</small><b>${T("14 من 20", "14 / 20")}</b><span>${T("درجة تُسجَّل… ويتوقف الأمر عندها.", "A grade is recorded… and that's where it ends.")}</span></div>
        <div class="mx-vs-arrow" aria-hidden="true">${T("←", "→")}</div>
        <div class="mx-vs-b"><small>${T("في إتقان", "In Itqan")}</small><b>${T("خارطة طريق", "A roadmap")}</b><span>${T("ما أتقنته الطالبة، وما ينقصها من مهارات، وفي أي مستوى معرفي: المعرفة أو التطبيق أو الاستدلال، ثم علاج يُعاد بعده التقويم في مهاراتها الناقصة وحدها.", "What the student has mastered, which skills she is missing and at which cognitive level (knowing, applying or reasoning), then treatment followed by re-assessment in her missing skills only.")}</span></div>
      </div>
      <div class="mx-pillars">
        <div><b>${T("تشخيص لا تصنيف", "Diagnosis, not ranking")}</b><span>${T("الفجوة عن الإتقان لكل طالبة ولكل مهارة، لا ترتيبها بين زميلاتها.", "Each student's gap to mastery in each skill, not her rank among her classmates.")}</span></div>
        <div><b>${T("علاج مبني على الدليل", "Evidence-based treatment")}</b><span>${T("القرار علاج أو دعم أو إثراء، بحسب ما تكشفه المهارات والمستوى المعرفي.", "The decision is remediation, support or enrichment, based on what the skills and cognitive level reveal.")}</span></div>
        <div><b>${T("ثقافة التعلم بالمهارات", "A culture of skills-based learning")}</b><span>${T("حين تعرف الطالبة مهاراتها يتحول التعلم من سباق على الدرجات إلى رحلة نحو الإتقان.", "When students know their skills, learning turns from a race for grades into a journey towards mastery.")}</span></div>
      </div>
    </section>
    <section class="mx-quote" aria-label="${T("حكمة", "Quote")}">
      <div class="mx-quote-in">
        <blockquote><p>${T("البيانات وحدها لا تغيّر التعليم… بل التربويون الذين يقرؤونها بحكمة.", "Data doesn’t change education — educators who read it wisely do.")}</p></blockquote>
        <p class="mx-quote-key">${T("القيمة الحقيقية لا تكمن في معرفة الدرجة فحسب، بل في فهم دلالاتها وتوظيفها في تحسين الأداء.", "The real value lies not just in knowing the grade, but in understanding what it means and using it to improve performance.")}</p>
        <p class="mx-quote-sub">${T("وإتقان تجعل هذه القراءة سهلة: تحوّل أوراق الإجابة والدرجات إلى صورة واضحة للمهارات والفجوات، وقرار جاهز لكل طالبة، دون جداول معقدة ولا حسابات يدوية.", "Itqan makes that reading easy: it turns answer sheets and marks into a clear picture of skills and gaps, with a ready decision for every student — no complex spreadsheets, no manual calculations.")}</p>
        <ul class="mx-quote-pts">
          <li><b>${T("من الدرجة إلى القرار", "From mark to decision")}</b><span>${T("علاج أو دعم أو إثراء لكل طالبة، محسوبًا تلقائيًا.", "Remediation, support or enrichment for each student, worked out automatically.")}</span></li>
          <li><b>${T("لوحات تُقرأ بنظرة", "Dashboards you read at a glance")}</b><span>${T("ألوان الإتقان، وخريطة المهارات، والإنذار المبكر بلغة واضحة.", "Mastery colours, a skills map and early warning in plain language.")}</span></li>
          <li><b>${T("لكل دور ما يحتاجه", "Each role sees what it needs")}</b><span>${T("المعلمة والمديرة والوكيلة والموجهة ووليّ الأمر، كلٌّ بقدر ما يخصه.", "Teacher, principal, deputies, counsellor and parent: each sees only what concerns them.")}</span></li>
        </ul>
      </div>
    </section>
    <section class="mx-sec" id="mx-roles"><h2>${T("الدخول إلى المنصة", "Sign in to the platform")}</h2><p class="muted">${T("اختاري صفتك في المدرسة.", "Choose your role in the school.")}</p>
      <div class="sp-roles">
        ${card("teacher", T("المعلمات", "Teachers"), T("المهارات، بنك الأسئلة، الاختبارات، التصحيح، التحليل، واختبارات التحسين.", "Skills, question bank, tests, marking, analysis and improvement tests."), "asTeacher")}
        ${card("student", T("الطالبة", "Student"), T("تقرير مهاراتي، واختباراتي، ومهامي الأدائية.", "My skills report, my tests and my performance tasks."), "spPin")}
        ${card("parent", T("وليّ الأمر", "Parent"), T("متابعة ابنتك أو بناتك برمز وليّ الأمر.", "Follow your daughter or daughters with the parent code."), "spPin")}
        ${["principal", "academic_deputy", "student_deputy", "counselor"].map((k) => card(k, rT(SROLE[k]), rD(SROLE[k]), "spStaff")).join("")}
      </div>
      <form class="door sp-pin" id="loginForm"><b>${T("دخول الطالبة ووليّ الأمر", "Student and parent sign-in")}</b><span>${T("أدخلي الرقم السري (أو رمز وليّ الأمر) لعرض تقرير المهارات.", "Enter the PIN (or the parent code) to see the skills report.")}</span>
        <div class="row"><input id="nid" type="password" inputmode="numeric" autocomplete="off" placeholder="${T("الرقم السري", "PIN")}" aria-label="${T("الرقم السري", "PIN")}"><button class="btn" type="submit">${T("دخول", "Sign in")}</button></div>
        <small id="loginErr" class="err"></small></form>
    </section>
    ${figs.length ? `<section class="mx-sec mx-num" id="mx-num"><h2>${T("إتقان في أرقام", "Itqan in numbers")}</h2>
      <div class="mx-figs">${figs.map(([k, n, l]) => `<div class="mx-fig"><i>${mxico(k)}</i><b dir="ltr" data-n="${n}">+${mxNum(n)}</b><span>${l}</span></div>`).join("")}</div>
      <p class="muted mx-note">${T("تُحسب هذه الأرقام تلقائيًا من المنصة، ولا تتضمن أي اسم أو بيانات شخصية.", "These figures are counted automatically by the platform and contain no names or personal data.")}</p></section>` : ""}
    <section class="mx-award" id="mx-awards">
      <div class="mx-award-in">
        <div class="mx-award-txt"><h2>${T("الجوائز والإشادات", "Awards and recognition")}</h2>
          <p>${T("حصلت منصة «إتقان» على <b>الميدالية الفضية</b> في <b>معرض ومسابقة الأمن والابتكار العالمية (SAIF)</b>، تقديرًا لفكرتها في قياس إتقان المهارات وعلاج الفجوات حتى تصل كل طالبة إلى الإتقان.", "Itqan won the <b>silver medal</b> at the <b>Security and Innovation Fair and Competition (SAIF)</b>, in recognition of its idea of measuring skill mastery and closing gaps until every student reaches mastery.")}</p></div>
        <figure class="mx-medal"><img src="${AWARD_IMG}" alt="${T("الميدالية الفضية لمنصة إتقان في معرض ومسابقة SAIF", "Itqan's silver medal at SAIF")}" loading="lazy" width="400" height="403"><figcaption>${T("الميدالية الفضية · SAIF", "Silver medal · SAIF")}</figcaption></figure>
      </div>
    </section>
    <section class="mx-sec" id="mx-how"><h2>${T("كيف تعمل إتقان", "How Itqan works")}</h2>
      <div class="hook"><b>${T("طالبتان… الدرجة نفسها 14 من 20… والفجوة مختلفة.", "Two students… the same 14 out of 20… and different gaps.")}</b><span>${T("الدرجة الكلية تُخفي المهارة الناقصة، فيُعاد الشرح للجميع ويضيع الجهد.", "The total score hides the missing skill, so everything is re-taught to everyone and effort is wasted.")}</span></div>
      <ol class="hsteps"><li><b>${T("يربط", "Links")}</b><span>${T("كل سؤال بمهارته ومستواه المعرفي", "every question to its skill and cognitive level")}</span></li><li><b>${T("يشخّص", "Diagnoses")}</b><span>${T("فجوة كل طالبة عن الإتقان", "each student's gap to mastery")}</span></li><li><b>${T("يقرّر", "Decides")}</b><span>${T("علاج أو دعم أو إثراء", "remediation, support or enrichment")}</span></li><li><b>${T("يعيد التقويم", "Re-assesses")}</b><span>${T("في مهاراتها الناقصة وحدها", "in her missing skills only")}</span></li></ol>
    </section>
    <footer class="mx-foot">
      <div class="mx-foot-in"><div class="mx-logo"><span class="mark">✓</span><div><b>${T("إتقان", "Itqan")}</b><small dir="ltr">itqanloop.com</small></div></div>
      <p>${T("بيانات الطالبات محفوظة ومشفّرة، ولا يرى كل دور إلا ما يخصه.", "Student data is stored encrypted, and each role sees only what concerns it.")}</p></div></footer>
  </div>`;
  document.body.classList.remove("priv"); applyLang(app); mxCount();
};
/* A subscribed school (school plan) has its own page, itqanloop.com/s/<code>, with its name and logo.
 * The platform's main page and the pages of schools without the plan show no school name. */
const SP_CODE = (location.pathname.match(/^\/s\/([a-z0-9_-]{2,40})\/?$/i) || [])[1];
if (SP_CODE && Store.schoolPage) Store.schoolPage(SP_CODE).then((r) => {
  if (r && r.moved) { location.replace("/s/" + r.moved); return; }
  if (r && r.school && r.school.plan === "school") { S.schoolPage = r.school; if (S.loaded && !S.role) render(); }
}).catch(() => {});
/** The figures count up once when they come into view (skipped when the device asks for reduced motion). */
function mxCount() {
  const els = [...document.querySelectorAll(".mx-fig b[data-n]")];
  if (!els.length || !("IntersectionObserver" in window) || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const el = e.target, n = +el.dataset.n, t0 = performance.now(), d = 1400;
    const step = (t) => { const k = Math.min(1, (t - t0) / d), v = Math.round(n * (1 - Math.pow(1 - k, 3))); el.textContent = "+" + mxNum(v); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.4 });
  els.forEach((el) => io.observe(el)); // the real figure stays visible until the animation starts
}
A.mxGo = (el) => { const t = document.getElementById(el.dataset.to); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); };
A.spPin = (el) => { const i = $("#nid"); if (!i) return; i.placeholder = el.dataset.r === "parent" ? T("رمز وليّ الأمر", "Parent code") : T("الرقم السري", "PIN"); i.closest("form").scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => i.focus(), 300); };
A.spStaff = (el) => {
  const r = el.dataset.r, t = rT(SROLE[r]);
  if (Store.demoStaff) return guard(async () => { S.role = "staff"; S.staffAs = r; S.ui.stTab = SROLE[r].tabs[0]; S.loaded = false; render(); await loadAll(); render(); window.scrollTo(0, 0); });
  modal(`<h3>${T("دخول " + t, "Sign in: " + t)}</h3><p class="muted">${T("بالبريد الإلكتروني وكلمة المرور اللذين وصلا في دعوة المديرة.", "With the e-mail and password from the principal's invitation.")}</p><form id="tpForm" data-mode="enter"><label class="fld">البريد الإلكتروني<input id="tpE" type="email" autocomplete="username" dir="ltr" required></label><label class="fld">كلمة المرور<input id="tp1" type="password" autocomplete="current-password" required></label><small id="tpErr" class="err"></small><div class="row end"><button class="lnk" type="button" data-act="tpForgot">نسيت كلمة المرور</button><button class="btn" type="submit">دخول</button></div></form>`);
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
  <header class="top"><div class="brand">${logo}<div><b>${T("إتقان", "Itqan")}</b><span data-keep>${esc(s.school)}</span></div></div>
    <div class="who"><span>${rT(R)}</span><button class="btn ghost sm" data-act="lang">${S.lang === "en" ? "العربية" : "English"}</button><button class="btn ghost sm" data-act="logout">${T("خروج", "Sign out")}</button></div></header>
  <nav class="tabs" aria-label="${rT(R)}">${R.tabs.map((k) => `<a href="#" data-act="stTab" data-k="${k}" class="${tab === k ? "on" : ""}">${tabT(k)}</a>`).join("")}</nav>
  ${S.loadError ? `<div class="note bad">${esc(S.loadError)}</div>` : ""}
  ${Store.demoStaff ? `<div class="note demo"><span>${T("<b>نسخة تجريبية.</b> تعرض اللوحة بيانات معلمة واحدة انضمت إلى المدرسة. في الموقع الحقيقي تظهر هنا كل معلمة تنضم.", "<b>Demo.</b> This dashboard shows one teacher who joined the school. On the real site every teacher who joins appears here.")}</span></div>` : ""}
  <div class="note">${T("لوحة للاطلاع فقط: لا تغيّر الدرجات ولا بيانات المعلمات. ولا تظهر فيها إلا بيانات المعلمات اللاتي انضممن إلى المدرسة.", "Read-only dashboard: it never changes marks or teachers' data, and shows only teachers who joined the school.")}</div>
  <main id="view">${({ overview: stOverview, academic: stAcademic, warning: stWarning, behavior: stBehavior, parents: stParents, staff: stStaff }[tab])()}</main>`;
  document.body.classList.remove("priv");
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
    <div class="grid4"><div class="tile"><b>${teachers.length}</b><span>${T("معلمة منضمة", "teachers joined")}</span></div><div class="tile"><b>${new Set(S.roster.map((x) => x.name)).size}</b><span>${T("طالبة", "students")}</span></div><div class="tile"><b>${classes.length}</b><span>${T("فصلًا", "classes")}</span></div><div class="tile"><b>${doneTests().length}</b><span>${T("اختبارًا مصحّحًا", "tests marked")}</span></div></div>
    <div class="grid4"><div class="tile"><b dir="ltr" style="font-size:1.45rem">${w("before")}% → ${w("after")}%</b><span>${T("متوسط الإتقان قبل التحسين وبعده (آخر اختبار لكل معلمة)", "Mean mastery before and after improvement (each teacher's latest test)")}</span></div><div class="tile"><b>${hi}</b><span>${T("طالبة في خطر مرتفع", "students at high risk")}</span></div><div class="tile"><b>${mid}</b><span>${T("تحتاج متابعة", "need follow-up")}</span></div><div class="tile"><b>${ackRate()}%</b><span>${T("اطلاع أولياء الأمور على آخر تقرير", "of parents saw the latest report")}</span></div></div></section>
  <section class="card"><h2>${T("المعلمات والمواد", "Teachers and subjects")}</h2><div class="scroll"><table class="tbl"><thead><tr><th>${T("المعلمة", "Teacher")}</th><th>${T("المادة", "Subject")}</th><th>${T("الصف", "Grade")}</th><th>${T("آخر اختبار", "Latest test")}</th><th>${T("الطالبات", "Students")}</th><th>${T("الإتقان قبل ← بعد", "Mastery before → after")}</th><th>SD</th></tr></thead><tbody>
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
  if (!rows.length) return `<section class="card"><h2>${tabT("academic")}</h2><p class="muted">${T("لا توجد اختبارات مصحّحة بعد.", "No marked tests yet.")}</p></section>`;
  const last = rows[0], g = last.g, L = { K: T("المعرفة", "Knowing"), A: T("التطبيق", "Applying"), R: T("الاستدلال", "Reasoning") };
  const cls = [...new Set(S.roster.filter((x) => last.t.results[x.id]).map((x) => x.cls))];
  return `<section class="card"><h2>${T("الاختبارات", "Tests")}</h2><div class="scroll"><table class="tbl"><thead><tr><th>${T("الاختبار", "Test")}</th><th>${T("المعلمة", "Teacher")}</th><th>${T("التاريخ", "Date")}</th><th>${T("الطالبات", "Students")}</th><th>${T("قبل التحسين", "Before improvement")}</th><th>${T("بعد التحسين", "After improvement")}</th><th>SD</th><th>${T("أتقنّ (80%+)", "Mastered (80%+)")}</th><th>${T("أقل من 60%", "Below 60%")}</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.t.name)}</td><td data-keep>${esc(tName(r.t._teacher))}</td><td class="num">${esc(r.t.date || "")}</td><td class="num">${r.n}</td><td class="num">${r.before}%</td><td class="num">${r.after}%</td><td class="num">${fmt(r.sd)}</td><td class="num">${r.mastered}</td><td class="num">${r.low}</td></tr>`).join("")}
  </tbody></table></div></section>
  <section class="card"><h2>${esc(last.t.name)}: ${T("حسب الفصل", "by class")}</h2><div class="scroll"><table class="tbl"><thead><tr><th>${T("الفصل", "Class")}</th><th>${T("الطالبات", "Students")}</th><th>${T("قبل", "Before")}</th><th>${T("بعد", "After")}</th><th>${T("أقل من 60%", "Below 60%")}</th></tr></thead><tbody>
    ${cls.map((c) => { const x = groupStats(last.t, c), tot = testMax(last.t); return `<tr><td>${esc(c)}</td><td class="num">${x.n}</td><td class="num">${pct(x.mean0, tot)}%</td><td class="num">${pct(x.mean, tot)}%</td><td class="num">${x.low}</td></tr>`; }).join("")}
  </tbody></table></div>
  <h3>${T("حسب المستوى المعرفي", "By cognitive level")}</h3><div class="grid4">${Object.entries(g.levels).filter(([, v]) => v.t).map(([k, v]) => `<div class="tile"><b dir="ltr">${pct(v.c0, v.t)}% → ${pct(v.c, v.t)}%</b><span>${L[k]}</span></div>`).join("")}</div>
  <h3>${T("المهارات الأضعف", "Weakest skills")}</h3><ul class="ew">${g.skills.slice(0, 6).map((o) => `<li class="${o.pct < 50 ? "high" : o.pct < 65 ? "mid" : "ok"}"><div><strong>${esc((sk(o.id) || {}).name || o.id)}</strong><span>${T(`الإتقان ${o.pct0}% ← ${o.pct}% بعد التحسين · ${o.low} طالبة أقل من 50%`, `Mastery ${o.pct0}% → ${o.pct}% after improvement · ${o.low} students below 50%`)}</span></div></li>`).join("")}</ul></section>`;
}
function stWarning() {
  const all = S.roster.map((st) => risk(st.id, true)).filter(Boolean), show = all.filter((r) => r.level !== "ok").sort((a, b) => b.pts - a.pts);
  return `<section class="card ewcard"><div class="hd"><h2>${T("الإنذار المبكر قبل التعثر", "Early warning before failure")}</h2><div class="legend"><span><i class="sq low"></i>${all.filter((r) => r.level === "high").length} ${T("خطر مرتفع", "high risk")}</span><span><i class="sq mid"></i>${all.filter((r) => r.level === "mid").length} ${T("تحتاج متابعة", "need follow-up")}</span><span><i class="sq high"></i>${all.filter((r) => r.level === "ok").length} ${T("مطمئنة", "on track")}</span></div></div>
    ${show.length ? `<ul class="ew">${show.slice(0, S.ui.ewAll ? 999 : 15).map((r) => { const st = stu(r.sid); return `<li class="${r.level}"><div><strong>${nm(st)} <small class="muted">${esc(st.cls)}${S.teachers ? " · " + esc(tName(st._teacher)) : ""}</small></strong><span>${r.why.map(esc).join(" · ")}</span></div></li>`; }).join("")}</ul>${show.length > 15 && !S.ui.ewAll ? `<button class="lnk" data-act="ewAll">${T("عرض الكل", "Show all")} (${show.length})</button>` : ""}` : `<p class="note ok">${T("لا توجد طالبة في دائرة الخطر حاليًا.", "No student is at risk right now.")}</p>`}
    <p class="muted">${T(`المؤشر نفسه الذي تراه المعلمة: الإتقان في آخر اختبار، والمهارات الأقل من ${EW.low}%، والتراجع، والمخالفات خلال ${EW.behDays} يومًا، ومتابعة وليّ الأمر.`, `The same indicator the teacher sees: mastery in the latest test, skills below ${EW.low}%, decline, behaviour entries in the last ${EW.behDays} days, and parent follow-up.`)}</p></section>`;
}
function stBehavior() {
  const from = new Date(Date.now() - EW.behDays * 864e5).toISOString().slice(0, 10), rec = S.behavior.filter((b) => b.date >= from);
  const neg = rec.filter(isNeg), pos = rec.filter((b) => !isNeg(b)), by = {};
  neg.forEach((b) => (by[b.sid] = (by[b.sid] || 0) + 1));
  const types = {}; rec.forEach((b) => { const k = (isNeg(b) ? "− " : "+ ") + (b.type || T("أخرى", "Other")); types[k] = (types[k] || 0) + 1; });
  const many = Object.entries(by).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  return `<section class="card"><h2>${T(`السلوك خلال ${EW.behDays} يومًا`, `Behaviour in the last ${EW.behDays} days`)}</h2>
    <div class="grid4"><div class="tile"><b>${pos.length}</b><span>${T("سلوكًا إيجابيًا", "positive entries")}</span></div><div class="tile"><b>${neg.length}</b><span>${T("مخالفة", "behaviour entries")}</span></div><div class="tile"><b>${many.length}</b><span>${T("طالبة بمخالفتين أو أكثر", "students with two or more")}</span></div></div>
    ${Object.keys(types).length ? `<h3>${T("الأنواع", "Types")}</h3><div class="scroll"><table class="tbl"><tbody>${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td class="num">${n}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">${T("لا توجد ملاحظات سلوكية مسجلة في هذه المدة.", "Nothing logged in this period.")}</p>`}
    ${many.length ? `<h3>${T("تحتاج متابعة سلوكية", "Need behaviour follow-up")}</h3><ul class="ew">${many.map(([sid, n]) => { const st = stu(sid); return st ? `<li class="${n >= EW.behMany ? "high" : "mid"}"><div><strong>${nm(st)} <small class="muted">${esc(st.cls)}</small></strong><span>${n} ${T("مخالفات", "entries")}</span></div></li>` : ""; }).join("")}</ul>` : ""}</section>`;
}
function stParents() {
  const t = doneTests()[0], ids = t ? Object.keys(t.results || {}) : [], not = ids.filter((sid) => !((S.acks[sid] || {}).seen || {})[t.id]);
  const canCodes = ["principal", "student_deputy"].includes(staffRole());
  return `<section class="card"><h2>${tabT("parents")}</h2>
    ${t ? `<div class="grid4"><div class="tile"><b>${ackRate()}%</b><span>${T("اطّلعوا على تقرير", "saw the report of")} ${esc(t.name)}</span></div><div class="tile"><b>${not.length}</b><span>${T("لم يطّلعوا بعد", "have not seen it yet")}</span></div></div>
    ${not.length ? `<details class="sheet"><summary>${T("من لم يطّلع وليّ أمرها", "Parents who have not seen it")} (${not.length})</summary><ul class="plain">${not.map((sid) => { const st = stu(sid); return st ? `<li>${nm(st)} <small class="muted">${esc(st.cls)}</small></li>` : ""; }).join("")}</ul></details>` : ""}` : `<p class="muted">${T("يظهر هنا اطلاع أولياء الأمور بعد أول تقرير.", "Parents' views appear here after the first report.")}</p>`}</section>
  ${canCodes ? `<section class="card"><h2>${T("رموز دخول أولياء الأمور", "Parent sign-in codes")}</h2><p>${T("لكل وليّ أمر رمز خاص من 8 أرقام، يدخل به من صفحة المدرسة ويتابع به أكثر من بنت. يُحفظ الرمز مشفّرًا، فلا يظهر إلا مرة واحدة عند إصداره: اطبعيه وسلّميه لوليّ الأمر.", "Each parent gets a personal 8-digit code to sign in from the school page and follow more than one daughter. The code is stored encrypted, so it is shown only once when issued: print it and hand it to the parent.")}</p>
    <div class="row wrap"><label class="fld">${T("الفصل", "Class")}<select id="pcCls"><option value="">${T("كل الفصول", "All classes")}</option>${[...new Set(S.roster.map((x) => x.cls))].map((c) => `<option>${esc(c)}</option>`).join("")}</select></label><button class="btn" data-act="stCodes">${T("إصدار الرموز", "Issue codes")}</button></div></section>` : ""}`;
}
A.stCodes = () => guard(async () => {
  const c = ($("#pcCls") || {}).value || "", list = S.roster.filter((x) => !c || x.cls === c);
  const r = Store.parentCodes ? await Store.parentCodes(list.map((x) => x.id)) : { codes: {} };
  const rows = list.filter((x) => r.codes[x.id]);
  modal(`<h3>${T("رموز أولياء الأمور", "Parent codes")}${c ? " · " + esc(c) : ""}</h3><p class="muted">${T("تظهر هذه الرموز الآن فقط. اطبعيها وسلّمي كل وليّ أمر رمزه.", "These codes are shown only now. Print them and give each parent their code.")}${Store.demoStaff ? T(" (رموز تجريبية للعرض)", " (demo codes)") : ""}</p>
    <div class="scroll"><table class="tbl" id="pcTbl"><thead><tr><th>${T("الطالبة", "Student")}</th><th>${T("الفصل", "Class")}</th><th>${T("رمز وليّ الأمر", "Parent code")}</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${nm(x)}</td><td>${esc(x.cls)}</td><td class="num" dir="ltr">${esc(r.codes[x.id])}</td></tr>`).join("")}</tbody></table></div>
    ${r.missing && r.missing.length ? `<p class="note warn">${T(`${r.missing.length} طالبة بلا رقم سري بعد، فلم يصدر لها رمز.`, `${r.missing.length} students have no PIN yet, so no code was issued for them.`)}</p>` : ""}
    <div class="row end"><button class="btn ghost" data-act="close">${T("إغلاق", "Close")}</button><button class="btn" data-act="stCodesPrint">${T("طباعة", "Print")}</button></div>`, true);
});
A.stCodesPrint = () => { const t = $("#pcTbl"); if (!t) return; const w = window.open("", "_blank"); if (!w) return toast("اسمحي بفتح النوافذ للطباعة."); w.document.write(`<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8"><title>رموز أولياء الأمور</title><style>body{font-family:Tahoma,Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:8px;text-align:right}</style><h2>${esc(S.settings.school)} · رموز دخول أولياء الأمور إلى منصة إتقان</h2>${t.outerHTML.replace(/class="pii"/g, "")}</html>`); w.document.close(); w.print(); };

function stStaff() {
  if (!S.members && !S.membersBusy) {
    S.membersBusy = true;
    (Store.schoolMembers ? Store.schoolMembers() : Promise.resolve({ members: [] })).then((r) => { S.members = r.members || []; }).catch(() => { S.members = []; }).finally(() => { S.membersBusy = false; render(); });
  }
  const RL = { teacher: T("معلمة", "Teacher"), principal: T("مديرة", "Principal"), academic_deputy: T("وكيلة تعليمية", "Academic deputy"), student_deputy: T("وكيلة طلابية", "Student affairs deputy"), counselor: T("موجهة طلابية", "Counsellor") };
  const ST = { active: [T("منضمة", "Joined"), "ok"], invited: [T("دُعيت ولم تقبل بعد", "Invited, not accepted yet"), ""], requested: [T("تطلب الانضمام", "Asks to join"), "warn"] };
  const m = S.members || [];
  return `<section class="card"><h2>${tabT("staff")}</h2>
    ${!S.members ? `<p class="muted">${T("جارٍ التحميل…", "Loading…")}</p>` : m.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>${T("الاسم", "Name")}</th><th>${T("الصفة", "Role")}</th><th>${T("المادة", "Subject")}</th><th>${T("الحالة", "Status")}</th><th></th></tr></thead><tbody>${m.map((x) => `<tr><td data-keep>${esc(x.name || x.email || "")}</td><td>${RL[x.role] || x.role}</td><td>${esc(x.subject || "")}</td><td><span class="chip ${ST[x.status] ? ST[x.status][1] : ""}">${ST[x.status] ? ST[x.status][0] : esc(x.status)}</span></td><td>${x.status === "requested" ? `<button class="btn sm" data-act="stDecide" data-m="${esc(x.id)}" data-a="approve">${T("قبول", "Approve")}</button>` : ""}${x.role !== "principal" ? `<button class="lnk danger" data-act="stDecide" data-m="${esc(x.id)}" data-a="remove">${T("إزالة", "Remove")}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">${T("لا يوجد أعضاء بعد.", "No members yet.")}</p>`}
    <p class="muted">${T("المعلمة التي تنضم تنتقل بياناتها إلى المدرسة بموافقتها. والمعلمة التي تُزال تبقى لها بياناتها كاملة، ولا تراها المدرسة بعد ذلك.", "A teacher who joins brings her data into the school with her consent. A teacher who is removed keeps all her data, and the school no longer sees it.")}</p></section>
  <section class="card"><h2>${T("دعوة عضو جديد", "Invite a new member")}</h2><p>${T("تصلها رسالة على بريدها، تضع منها كلمة المرور ثم تدخل من صفحة المدرسة.", "She receives an e-mail, sets her password from it, then signs in from the school page.")}</p>
    <div class="row wrap"><label class="fld grow">${T("البريد الإلكتروني", "E-mail")}<input id="invE" type="email" dir="ltr" autocomplete="off"></label><label class="fld">${T("الصفة", "Role")}<select id="invR">${["teacher", "academic_deputy", "student_deputy", "counselor"].map((k) => `<option value="${k}">${RL[k]}</option>`).join("")}</select></label><button class="btn" data-act="stInvite">${T("إرسال الدعوة", "Send invitation")}</button></div></section>`;
}
A.stInvite = () => guard(async () => {
  const e = ($("#invE").value || "").trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw { message: T("اكتبي بريدًا إلكترونيًا صحيحًا.", "Enter a valid e-mail address.") };
  await Store.schoolInvite(e, $("#invR").value); S.members = null; render();
}, T("أُرسلت الدعوة.", "Invitation sent."));
A.stDecide = (el) => guard(async () => { await Store.schoolDecide(el.dataset.m, el.dataset.a); S.members = null; render(); }, T("تم.", "Done."));

/* ---------- demo only: the real names are stored encrypted; the password is asked once when the teacher enters ---------- */
if (Store.demoStaff) {
  const enterTeacher = () => guard(async () => { A.close(); S.role = "teacher"; S.loaded = false; render(); await loadAll(); render(); window.scrollTo(0, 0); });
  A.asTeacher = () => {
    if (!Store.namesLocked || !Store.namesLocked()) return enterTeacher();
    modal(`<h3>${T("دخول المعلمة", "Teacher sign-in")}</h3><p class="muted">${T("أسماء الطالبات الحقيقية محفوظة مشفّرة في هذه الصفحة. اكتبي كلمة المرور لتظهر.", "Real student names are stored encrypted on this page. Enter the password to show them.")}</p>
      <label class="fld">${T("كلمة المرور", "Password")}<input id="unlockPw" type="password" autocomplete="off" autocapitalize="off" spellcheck="false"></label><small id="unlockErr" class="err"></small>
      <div class="row end wrap"><button class="lnk" data-act="enterNoNames">${T("الدخول بأسماء مؤقتة", "Enter with placeholder names")}</button><button class="btn" data-act="unlockNames">${T("دخول", "Sign in")}</button></div>`);
    setTimeout(() => { const i = $("#unlockPw"); if (i) i.focus(); }, 50);
  };
  A.enterNoNames = () => enterTeacher();
  A.unlockNames = () => guard(async () => {
    const pw = (($("#unlockPw") || {}).value || "").trim();
    if (!(await Store.unlockNames(pw))) { $("#unlockErr").textContent = T("كلمة المرور غير صحيحة.", "Wrong password."); return; }
    await enterTeacher();
  });
}

/* ===== Quality assurance & accreditation (added in the new platform) =====
 * Evidence-based assessment, instructional decisions, quality indicators, accreditation evidence,
 * test validity and reliability, and trends for planning. Aggregate figures only: no student names,
 * so the page can be printed and shared with supervisors or review committees.
 * Runs inside boot(): it uses the original helpers (S, esc, pct, groupStats, …). */
NAV.splice(NAV.findIndex((n) => n[0] === "school"), 0, ["quality", "الجودة والاعتماد"]);
Object.assign(EN, {
  "الجودة والاعتماد": "Quality & accreditation", "مؤشرات الأداء الرئيسة": "Key performance indicators", "المؤشر": "Indicator", "القيمة": "Value", "المستهدف": "Target", "الحالة": "Status",
  "صدق الاختبار: جدول المواصفات والمواءمة مع نواتج التعلم": "Test validity: blueprint and alignment with learning outcomes", "ثبات الاختبار وجودة الأسئلة": "Test reliability and item quality",
  "الاتجاهات عبر الاختبارات": "Trends across tests", "توثيق ممارسات التقويم": "Assessment practice evidence", "المستهدفات والمعيار المرجعي": "Targets and benchmark",
  "طباعة التقرير أو حفظه PDF": "Print or save as PDF", "محقَّق": "Met", "غير محقَّق": "Not met", "قريب": "Close",
});
const KPI_DEF = { crit: 80, share: 70, national: "", nationalLabel: "", lv: { K: 35, A: 35, R: 30 } };
const kpiCfg = () => { const k = Object.assign({}, KPI_DEF, S.settings.kpi || {}); k.lv = Object.assign({}, KPI_DEF.lv, k.lv || {}); return k; };
const ctxNow = () => ({ skills: S.skills, roster: S.roster, imps: Object.values(S.imps), bank: S.bank });
const st3 = (v, target, near = 5) => (v == null || target == null || target === "" ? "" : v >= +target ? `<span class="pill high">محقَّق</span>` : v >= +target - near ? `<span class="pill mid">قريب</span>` : `<span class="pill low">غير محقَّق</span>`);
const ITEM_VERDICT = {
  ok: ["high", "جيد", "يُحتفظ به في بنك الأسئلة."],
  easy: ["mid", "سهل جدًا", "يقيس الحد الأدنى؛ يناسب التمهيد، أو استبدليه بسؤال تطبيق في المهارة نفسها."],
  hard: ["mid", "صعب جدًا", "راجعي وضوح صياغته، وتأكدي أن مهارته دُرّست بما يكفي."],
  lowDisc: ["mid", "تمييز ضعيف", "لا يفرّق بين المتقنة وغير المتقنة: راجعي البدائل والصياغة."],
  negDisc: ["low", "تمييز سالب", "المتفوقات أخطأن فيه أكثر من غيرهن: راجعي مفتاح الإجابة أو غموض السؤال."],
};
const ALPHA_TXT = { high: "ثبات مرتفع: الدرجات متسقة ويمكن الاعتماد عليها في القرار.", mid: "ثبات مقبول لاختبار صفي.", low: "ثبات منخفض: الدرجات قد تتأثر بعوامل غير الإتقان؛ زيدي عدد الأسئلة الجيدة وراجعي الأسئلة المعلَّمة.", none: "لا يكفي عدد الطالبات أو الأسئلة لحساب الثبات." };

function lineChart(rows, series) { // rows: [{name, ...}], series: [{key, label, col, dash}]
  if (rows.length < 2) return `<p class="muted">يظهر الرسم بعد إدخال نتائج اختبارين على الأقل.</p>`;
  const W = 760, H = 260, L = 40, R = 14, T = 14, B = 54, pw = W - L - R, ph = H - T - B;
  const X = (i) => L + (rows.length === 1 ? pw / 2 : (i / (rows.length - 1)) * pw), Y = (v) => T + ph - (v / 100) * ph;
  const grid = [0, 25, 50, 75, 100].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#dfe6df"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="12" fill="#5d716e">${v}%</text>`).join("");
  const xl = rows.map((r, i) => `<text x="${X(i)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="#16302d">${esc(String(r.name).slice(0, 22))}</text><text x="${X(i)}" y="${H - B + 34}" text-anchor="middle" font-size="10" fill="#5d716e">${esc(r.date)}</text>`).join("");
  const lines = series.map((s) => { const pts = rows.map((r, i) => (r[s.key] == null ? null : [X(i), Y(r[s.key])])).filter(Boolean); return `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${s.col}" stroke-width="3" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${s.col}"/>`).join("")}`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="اتجاه متوسط الإتقان عبر الاختبارات" style="width:100%;height:auto;direction:ltr">${grid}${xl}${lines}</svg>
    <div class="legend">${series.map((s) => `<span><svg width="30" height="10" aria-hidden="true"><line x1="1" x2="29" y1="5" y2="5" stroke="${s.col}" stroke-width="3" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/></svg>${s.label}</span>`).join("")}</div>`;
}

function vQuality() {
  const t = curTest();
  if (!t || !Object.keys(t.results || {}).length) return `<section class="card"><h2>الجودة والاعتماد</h2><p class="muted">يظهر التقرير بعد إدخال نتائج اختبار واحد على الأقل.</p></section>`;
  const cls = S.ui.cls || "", k = kpiCfg(), ctx = ctxNow(), g = groupStats(t, cls), tot = testMax(t);
  const sids = sortedStudents(cls).filter((s) => t.results[s.id]).map((s) => s.id);
  const ia = itemAnalysis(t, sids), dxs = distractors(t, sids), bp = blueprint(ctx, t), tr = trends(ctx, Object.values(S.tests), classes());
  const mastered = (list) => list.filter((x) => pct(x.score, x.total) >= k.crit).length;
  const lvP = (L, after) => (g.levels[L].t ? pct(after ? g.levels[L].c : g.levels[L].c0, g.levels[L].t) : null);
  const ms = impsOf(t.id).filter((m) => Object.keys(m.results || {}).length), sent = (fn) => sids.filter((id) => fn(sentOf(id, t.id))).length;
  const seenN = sids.filter((id) => ((S.acks[id] || {}).seen || {})[t.id]).length;
  const skillsOk = g.skills.filter((x) => x.pct >= k.crit).length;
  const nat = k.national === "" || k.national == null ? null : +k.national;
  const row = (label, val, target, status, note) => `<tr><td>${label}${note ? `<br><small class="muted">${note}</small>` : ""}</td><td class="num"><b>${val}</b></td><td class="num">${target ?? "—"}</td><td>${status || ""}</td></tr>`;
  const scope = cls ? "فصل " + esc(cls) : "كل الفصول";
  const kpis = [
    row("متوسط الإتقان في الاختبار", `${pct(g.mean0, tot)}%`, `${k.crit}%`, st3(pct(g.mean0, tot), k.crit)),
    g.rec ? row("متوسط الإتقان بعد اختبار التحسين", `${pct(g.mean, tot)}%`, `${k.crit}%`, st3(pct(g.mean, tot), k.crit), `بعد ${ms.length} ${ms.length === 1 ? "اختبار تحسين" : "اختبارات تحسين"}`) : "",
    row(`نسبة الطالبات المتقنات (${k.crit}% فأكثر)`, `${g.n ? Math.round((mastered(g.students) / g.n) * 1000) / 10 : 0}%`, `${k.share}%`, st3(g.n ? (mastered(g.students) / g.n) * 100 : 0, k.share), `${mastered(g.students)} من ${g.n} طالبة`),
    row("نسبة المهارات المتقنة على مستوى المجموعة", `${pct(skillsOk, g.skills.length)}%`, "—", "", `${skillsOk} من ${g.skills.length} مهارة بلغت ${k.crit}%`),
    ...["K", "A", "R"].filter((L) => g.levels[L].t).map((L) => row(`الإتقان في مستوى ${LEVELS[L]}`, `${lvP(L)}%`, `${k.crit}%`, st3(lvP(L), k.crit))),
    g.lost ? row("الدرجات المفقودة التي استُعيدت بالتحسين", `${pct(g.rec, g.lost)}%`, "—", "", "مؤشر على فاعلية التقويم التكويني والعلاج") : "",
    row("اطلاع أولياء الأمور على التقرير", `${pct(seenN, g.n)}%`, "—", "", `${seenN} من ${g.n}`),
    row("خطة علاجية أو إثرائية أُرسلت", `${pct(sent((o) => o.plan), g.n)}%`, "100%", st3(pct(sent((o) => o.plan), g.n), 100, 10)),
    row("معامل ثبات الاختبار (ألفا كرونباخ / KR-20)", ia.alpha == null ? "—" : f2(ia.alpha), "0.7", ia.alpha == null ? "" : st3(ia.alpha * 100, 70, 10)),
    nat != null ? row(`المقارنة بالمعيار المرجعي${k.nationalLabel ? " (" + esc(k.nationalLabel) + ")" : ""}`, `${pct(g.mean0, tot)}%`, `${fmt(nat)}%`, st3(pct(g.mean0, tot), nat), "متوسط المدرسة مقابل المعيار الذي أدخلتِه") : "",
  ].join("");

  const lvRows = bp.levels.map((l) => { const diff = Math.round((l.pct - k.lv[l.L]) * 10) / 10; return `<tr><td>${LEVELS[l.L]}</td><td class="num">${fmt(l.marks)}</td><td class="num"><b>${l.pct}%</b></td><td class="num">${k.lv[l.L]}%</td><td>${Math.abs(diff) <= 10 ? `<span class="pill high">متوازن</span>` : diff > 0 ? `<span class="pill mid">أعلى من المستهدف ${fmt(diff)}</span>` : `<span class="pill mid">أقل من المستهدف ${fmt(-diff)}</span>`}</td></tr>`; }).join("");
  const chRows = bp.chapters.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${fmt(c.marks)} <small class="muted">(${c.pct}%)</small></td><td class="num">${["K", "A", "R"].map((L) => fmt(c.byLv[L])).join(" / ")}</td><td class="num">${c.skills} من ${c.allSkills}</td><td class="w">${bar(c.coverage)} <span class="num">${c.coverage}%</span></td></tr>`).join("");

  const flagged = ia.items.filter((x) => x.flags.length);
  const v = (x) => ITEM_VERDICT[x.flags.includes("negDisc") ? "negDisc" : x.flags[0] || "ok"];
  const itemRows = ia.items.map((x) => { const s = sk(x.skill) || {}, [c, l, act] = v(x); return `<tr><td class="num">${x.i + 1}</td><td>${esc(s.name || "")}<br><small class="muted">${LEVELS[s.level] || ""}</small></td><td class="num">${f2(x.p)}</td><td class="num">${x.d == null ? "—" : f2(x.d)}</td><td class="num">${x.r == null ? "—" : f2(x.r)}</td><td class="num">${x.alphaIfDeleted == null ? "—" : f2(x.alphaIfDeleted)}</td>${optCell(dxs[x.i], t.qs[x.i])}<td><span class="pill ${c}">${l}</span><br><small class="muted">${act}</small></td></tr>`; }).join("");

  const trRows = tr.map((r) => `<tr><td>${esc(r.name)}<br><small class="muted">${esc(r.date)} · ${r.n} طالبة</small></td><td class="num">${r.before}%</td><td class="num">${r.after !== r.before ? r.after + "%" : "—"}</td>${["K", "A", "R"].map((L) => `<td class="num">${r.levels[L] == null ? "—" : r.levels[L] + "%"}</td>`).join("")}<td class="num">${r.masteredShare}%</td></tr>`).join("");
  const clsTrend = classes().length > 1 && tr.length > 1 ? `<div class="scroll"><table class="tbl"><thead><tr><th>الفصل</th>${tr.map((r) => `<th>${esc(r.name)}</th>`).join("")}</tr></thead><tbody>${classes().map((c) => `<tr><td>فصل ${esc(c)}</td>${tr.map((r) => `<td class="num">${r.classes[c] == null ? "—" : r.classes[c] + "%"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";

  const all = Object.values(S.tests).filter((x) => Object.keys(x.results || {}).length);
  const summative = all.filter((x) => ["p1", "p2", "final"].includes(x.type)).length, rounds = Object.values(S.imps).filter((m) => Object.keys(m.results || {}).length).length;
  const tasks = Object.values(S.acks).reduce((a, x) => a + Object.values(x.sent || {}).filter((o) => o.task).length, 0), plans = Object.values(S.acks).reduce((a, x) => a + Object.values(x.sent || {}).filter((o) => o.plan).length, 0);
  const notesN = Object.values(S.acks).reduce((a, x) => a + (x.notes || []).length, 0), papersSent = Object.values(S.acks).reduce((a, x) => a + Object.values(x.sent || {}).filter((o) => o.paper).length, 0);

  return `<section class="card qhead"><div class="hd"><h2>الجودة والاعتماد <small class="muted">${esc(t.name)} · ${scope}</small></h2><div class="row wrap noprint">${testSelect("qT")}${clsSelect()}<button class="btn" data-act="qPrint">${IC.dl} طباعة التقرير أو حفظه PDF</button></div></div>
    <p class="muted">تقرير مجمَّع بلا أسماء طالبات، يصلح لمشاركته مع المشرفة أو لجان ضمان الجودة والاعتماد. ${esc(S.settings.school || "")} · ${esc(S.settings.subject || "")} · ${esc(S.settings.grade || "")} · ${esc(S.settings.term || "")} ${esc(S.settings.year || "")}</p></section>
  <section class="card"><h2>1. التقويم القائم على الأدلة: مؤشرات الأداء الرئيسة</h2>
    <p class="muted">كل مؤشر محسوب من إجابات الطالبات الفعلية، وكل سؤال مربوط بمهارة (ناتج تعلّم) ومستوى معرفي من إطار تيمز.</p>
    <div class="scroll"><table class="tbl"><thead><tr><th>المؤشر</th><th>القيمة</th><th>المستهدف</th><th>الحالة</th></tr></thead><tbody>${kpis}</tbody></table></div></section>
  <section class="card"><h2>2. صدق الاختبار: جدول المواصفات والمواءمة مع نواتج التعلم</h2>
    <p class="muted">صدق المحتوى: توزيع الدرجات على المستويات المعرفية مقارنةً بالمستهدف، ونسبة ما غطّاه الاختبار من مهارات الفصول التي يشملها (${bp.tested} من ${bp.inScope} مهارة، ${bp.coverage}%).</p>
    <div class="scroll"><table class="tbl"><thead><tr><th>المستوى المعرفي</th><th>الدرجات</th><th>النسبة في الاختبار</th><th>المستهدف</th><th>المواءمة</th></tr></thead><tbody>${lvRows}</tbody></table></div>
    <div class="scroll"><table class="tbl"><thead><tr><th>الفصل (الوحدة)</th><th>الدرجات</th><th>معرفة / تطبيق / استدلال</th><th>المهارات المقيسة</th><th>تغطية نواتج التعلم</th></tr></thead><tbody>${chRows}</tbody></table></div></section>
  <section class="card"><h2>3. ثبات الاختبار وجودة الأسئلة</h2>
    <div class="grid4"><div class="tile"><b>${ia.alpha == null ? "—" : f2(ia.alpha)}</b><span>معامل الثبات (ألفا / KR-20)</span></div><div class="tile"><b>${ia.sem == null ? "—" : f2(ia.sem)}</b><span>الخطأ المعياري للقياس (من ${fmt(ia.total)})</span></div><div class="tile"><b>${f2(ia.meanP)}</b><span>متوسط معامل السهولة</span></div><div class="tile"><b>${flagged.length}</b><span>سؤالًا يحتاج مراجعة من ${ia.k}</span></div></div>
    <p class="note ${alphaBand(ia.alpha) === "low" ? "warn" : alphaBand(ia.alpha) === "high" ? "ok" : ""}">${ALPHA_TXT[alphaBand(ia.alpha)]}${ia.sem != null ? ` درجة الطالبة الحقيقية تقع غالبًا بين درجتها ناقص ${f2(ia.sem)} وزائد ${f2(ia.sem)}.` : ""}${ia.n < 20 ? ` (الحساب على ${ia.n} طالبة فقط؛ يصبح أدق مع 20 طالبة فأكثر.)` : ""}</p>
    <details class="sheet"${flagged.length ? " open" : ""}><summary>تحليل كل سؤال (${ia.k})</summary><div class="scroll"><table class="tbl"><thead><tr><th>السؤال</th><th>المهارة</th><th>السهولة</th><th>التمييز</th><th>الارتباط بالدرجة</th><th>الثبات لو حُذف</th><th>البدائل (عدد من اختارت كلًّا)</th><th>الحكم والإجراء</th></tr></thead><tbody>${itemRows}</tbody></table></div>
    <p class="muted small">السهولة: نسبة الدرجة المتحققة في السؤال (المناسب 0.2–0.9). التمييز: الفرق بين أعلى 27% وأدنى 27% من الطالبات (0.2 فأكثر جيد، والسالب يستدعي مراجعة المفتاح). الثبات لو حُذف: إن ارتفع عن ${ia.alpha == null ? "معامل الثبات" : f2(ia.alpha)} فالسؤال يُضعف الاختبار. التحليل على الدرجات الأولى قبل اختبارات التحسين. البدائل تظهر عند التصحيح بملف إكسل أو بالتصوير (حيث تُحفظ الإجابة المختارة)؛ البديل الذي لا يختاره أحد لا يعمل، والذي يجذب المتفوقات يحتاج مراجعة. تُحفظ سهولة كل سؤال وتمييزه في بنك الأسئلة لتختاري للاختبارات القادمة أسئلة جودتها مثبتة.</p></details></section>
  <section class="card"><h2>4. الاتجاهات عبر الاختبارات (للتخطيط)</h2>
    ${lineChart(tr, [{ key: "before", label: "متوسط الإتقان في الاختبار", col: "#1f5e57" }, { key: "after", label: "بعد التحسين", col: "#c9962b", dash: "6 4" }])}
    <div class="scroll"><table class="tbl"><thead><tr><th>الاختبار</th><th>الإتقان</th><th>بعد التحسين</th><th>${LEVELS.K}</th><th>${LEVELS.A}</th><th>${LEVELS.R}</th><th>المتقنات</th></tr></thead><tbody>${trRows}</tbody></table></div>${clsTrend}
    <p class="muted">تتراكم هذه البيانات مع كل اختبار، فتكشف اتجاه المستوى والمستوى المعرفي الأضعف، وتدعم قرارات القسم والمدرسة.</p></section>
  <section class="card"><h2>5. توثيق ممارسات التقويم (أدلة للاعتماد والمراجعة)</h2><div class="scroll"><table class="tbl"><tbody>
    <tr><td>اختبارات ختامية بنتائج (فترة أولى/ثانية/نهائي)</td><td class="num"><b>${summative}</b></td></tr>
    <tr><td>جولات تقويم تكويني: اختبارات تحسين مصحَّحة</td><td class="num"><b>${rounds}</b></td></tr>
    <tr><td>مهام أدائية بسلّم تقدير أُرسلت للطالبات</td><td class="num"><b>${tasks}</b></td></tr>
    <tr><td>خطط علاجية وإثرائية فردية أُرسلت</td><td class="num"><b>${plans}</b></td></tr>
    <tr><td>أوراق اختبار بنتيجة كل سؤال أُرسلت لأولياء الأمور</td><td class="num"><b>${papersSent}</b></td></tr>
    <tr><td>ملاحظات متبادلة مع أولياء الأمور</td><td class="num"><b>${notesN}</b></td></tr>
    <tr><td>أسئلة في البنك مربوطة بمهارة ومستوى</td><td class="num"><b>${S.bank.length}</b></td></tr>
    <tr><td>مهارات (نواتج تعلّم) معرَّفة بمستوياتها</td><td class="num"><b>${S.skills.length}</b></td></tr>
    <tr><td>قيود في سجل التعديلات (كل الاختبارات)</td><td class="num"><b>${S.audit ? S.audit.list.length : "…"}</b></td></tr></tbody></table></div></section>
  ${auditSection(t)}
  <section class="card noprint"><h2>المستهدفات والمعيار المرجعي</h2><form id="kpiForm" class="grid2">
    <label class="fld">محك الإتقان %<input id="kp_crit" type="number" min="1" max="100" value="${k.crit}"></label>
    <label class="fld">نسبة الطالبات المتقنات المستهدفة %<input id="kp_share" type="number" min="1" max="100" value="${k.share}"></label>
    <label class="fld">معيار مرجعي للمقارنة % (اختياري)<input id="kp_nat" type="number" min="0" max="100" step="0.1" value="${esc(k.national)}" placeholder="مثل متوسط نافس أو متوسط الإدارة"></label>
    <label class="fld">اسم المعيار المرجعي<input id="kp_natL" value="${esc(k.nationalLabel)}" placeholder="مثال: متوسط اختبارات نافس للمنطقة"></label>
    <label class="fld">نسبة المستوى المعرفي المستهدفة في الاختبار: معرفة / تطبيق / استدلال<span class="row"><input id="kp_K" type="number" min="0" max="100" value="${k.lv.K}" style="width:5em"><input id="kp_A" type="number" min="0" max="100" value="${k.lv.A}" style="width:5em"><input id="kp_R" type="number" min="0" max="100" value="${k.lv.R}" style="width:5em"></span><small class="muted">الافتراضي توزيع تيمز للصف الثاني المتوسط: 35 / 35 / 30.</small></label>
    <div class="row end full"><button class="btn" type="submit">حفظ المستهدفات</button></div></form></section>`;
}
A.qPrint = () => window.print();
document.addEventListener("submit", (e) => {
  if (e.target.id !== "kpiForm") return;
  e.preventDefault();
  const n = (id) => $("#" + id).value;
  guard(async () => {
    S.settings.kpi = { crit: Math.max(1, Math.min(100, +n("kp_crit") || 80)), share: Math.max(1, Math.min(100, +n("kp_share") || 70)), national: n("kp_nat") === "" ? "" : +n("kp_nat"), nationalLabel: n("kp_natL").trim(), lv: { K: +n("kp_K") || 0, A: +n("kp_A") || 0, R: +n("kp_R") || 0 } };
    await save.settings(); render();
  }, "حُفظت المستهدفات.");
});
{ const st = document.createElement("style"); st.textContent = `@media print{.top,.tabs,.noprint,.note.peek,#toast,#tour{display:none!important}body{background:#fff}.card{break-inside:avoid;box-shadow:none}details.sheet>*{display:block}details.sheet:not([open])>*:not(summary){display:block}#app{max-width:none;padding:0}}`; document.head.appendChild(st); }

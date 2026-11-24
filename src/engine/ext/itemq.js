/* ===== Question quality in the bank, and distractor analysis =====
 * Each bank question carries its difficulty and discrimination from every test it appeared in (10+ students),
 * and objective questions show how many students chose each option when the answers were recorded
 * (Excel file or photographed sheets). */
const f2 = (v) => (v == null ? "—" : (Math.round(v * 100) / 100).toFixed(2));
let _bq = null, _bqKey = "";
function bankQuality() {
  const key = Object.values(S.tests).map((t) => t.id + ":" + Object.keys(t.results || {}).length).join("|") + "#" + S.roster.length;
  if (key !== _bqKey) { _bq = bankStats(Object.values(S.tests), S.roster); _bqKey = key; }
  return _bq;
}
const Q_FLAG = { easy: "سهل جدًا", hard: "صعب جدًا", lowDisc: "تمييز ضعيف", negDisc: "تمييز سالب" };
function qStatChip(q) {
  if (S.role !== "teacher" || !q || !q.id) return "";
  const s = bankQuality()[q.id];
  if (!s) return "";
  const c = s.flags.includes("negDisc") ? "low" : s.flags.length ? "mid" : "high";
  return `<span class="pill ${c}" title="من ${s.uses} ${s.uses === 1 ? "اختبار" : "اختبارات"} و${s.n} إجابة">السهولة ${f2(s.p)} · التمييز ${s.d == null ? "—" : f2(s.d)}${s.flags.length ? " · " + s.flags.map((f) => Q_FLAG[f]).join("، ") : " · جودة مثبتة"}</span>`;
}
Object.assign(C, { bPref: (el) => { S.ui.bPref = el.checked; } });
/** One cell of the item-analysis table: counts per option; ✓ marks the key. */
function optCell(dx, q) {
  if (!dx) return `<td class="muted small">${isAuto(q) ? "لم تُسجَّل الإجابات" : "—"}</td>`;
  const lab = (k) => (q.type === "tf" ? ["صح", "خطأ"][k] : LETTERS[k]);
  const notes = dx.opts.filter((o) => o.flag).map((o) => (o.flag === "unused" ? `البديل «${lab(o.k)}» لم يختره أحد: استبدليه ببديل أقوى.` : `البديل «${lab(o.k)}» جذب المتفوقات أكثر من غيرهن: راجعي صياغته أو المفتاح.`));
  return `<td><span class="num">${dx.opts.map((o) => `<b class="${o.key ? "" : o.flag ? "err" : ""}" style="${o.key ? "color:var(--high)" : ""}">${lab(o.k)}${o.key ? "✓" : ""}</b> ${o.n}`).join(" · ")}${dx.blank ? ` · فارغ ${dx.blank}` : ""}</span>${notes.length ? `<br><small class="muted">${notes.join(" ")}</small>` : ""}</td>`;
}

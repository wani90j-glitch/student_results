/* ===== English interface: full sentences, never half-translated =====
 * Text nodes are looked up whole (EN, then I18N with every number replaced by "#", e.g. "متوسط الاختبار من # (#%)").
 * A line made of parts joined by " · " is translated part by part. Curriculum content and names stay as written.
 * The old word-by-word fallback (which produced mixed lines such as "قريب of حد التعثر") is no longer used. */
const I18N_NUM = /\d+(?:[.,]\d+)?/g;
function enOne(core) {
  if (EN[core]) return EN[core];
  if (I18N[core]) return I18N[core];
  const nums = core.match(I18N_NUM);
  if (nums) { const tr = I18N[core.replace(I18N_NUM, "#")]; if (tr) { let i = 0; return tr.replace(/#/g, () => (i < nums.length ? nums[i++] : "#")); } }
  return null;
}
enText = function (t) {
  const core = String(t).replace(/\s+/g, " ").trim();
  if (!core || !/[؀-ۿ]/.test(core)) return t;
  let tr = enOne(core);
  if (tr == null && core.includes(" · ")) {
    const parts = core.split(" · ").map((x) => enOne(x) || x);
    tr = parts.join(" · ");
  }
  if (tr == null) { let out = core; EN_PHRASES.forEach(([a, b]) => { if (out.includes(a)) out = out.split(a).join(b); }); tr = out; }
  const lead = /^\s*/.exec(t)[0], trail = /\s*$/.exec(t)[0];
  return lead + tr + trail;
};
applyLang = function (root) {
  const en = S.lang === "en";
  document.documentElement.lang = en ? "en" : "ar"; document.documentElement.dir = en ? "ltr" : "rtl";
  if (!en || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && n.parentElement.closest(".cq .stem,.cq .opts,.pii,.skl>span,textarea,.thread,.todo b,[data-keep]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach((n) => { const t = enText(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; });
  root.querySelectorAll("[placeholder],[aria-label],[title]").forEach((el) => ["placeholder", "aria-label", "title"].forEach((a) => { const v = el.getAttribute(a); if (v) { const t = enText(v); if (t !== v) el.setAttribute(a, t); } }));
};
const _toast0 = toast;
toast = function (msg, bad) { return _toast0(S.lang === "en" ? enText(String(msg)) : msg, bad); };

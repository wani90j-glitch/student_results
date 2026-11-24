"use client";
/**
 * The storage the ported UI talks to. It keeps the original call shapes (Store.set("tests/<id>", t), …)
 * and turns each call into database writes through the user's own session, so Row Level Security applies.
 * Teacher edits made while offline are queued on this device and sent when the connection returns.
 */
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  ackToRows, behaviorToRows, groupsToRows, impToRows, qimgToRows, questionsToRows, rosterToRows, rowsToState, settingsToRows, sheetsToRows,
  skillsToRows, subjectsToRows, testToRows, type Own, type Row,
} from "@/lib/data/mapping";

type S = Record<string, any>;
const QKEY = "itqan:queue";

async function allRows(sb: any, table: string, filters: Record<string, string> = {}, cols = "*") {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}
const chunks = <T,>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const check = (r: { error: any }) => { if (r.error) throw r.error; return r; };
async function upsert(sb: any, table: string, rows: Row[], onConflict: string) {
  for (const c of chunks(rows)) if (c.length) check(await sb.from(table).upsert(c, { onConflict }));
}
/** Deletes rows of `table` in scope whose key is not in `keep`. */
async function prune(sb: any, table: string, scope: Record<string, string>, keyCol: string, keep: string[]) {
  let q = sb.from(table).delete();
  for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
  if (keep.length) q = q.not(keyCol, "in", `(${keep.map((k) => `"${String(k).replace(/"/g, '""')}"`).join(",")})`);
  check(await q);
}

async function toJpegBase64(src: Blob | HTMLCanvasElement, max = 1600): Promise<{ data: string; type: "image/jpeg" }> {
  let canvas: HTMLCanvasElement;
  if (src instanceof HTMLCanvasElement) canvas = src;
  else {
    const url = URL.createObjectURL(src);
    try {
      const im = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("image")); i.src = url; });
      canvas = document.createElement("canvas");
      canvas.width = im.naturalWidth; canvas.height = im.naturalHeight;
      canvas.getContext("2d")!.drawImage(im, 0, 0);
    } finally { URL.revokeObjectURL(url); }
  }
  const s = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * s); out.height = Math.round(canvas.height * s);
  const x = out.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, out.width, out.height); x.drawImage(canvas, 0, 0, out.width, out.height);
  return { data: out.toDataURL("image/jpeg", 0.85).split(",")[1], type: "image/jpeg" };
}

export function createStore() {
  const sb = supabaseBrowser();
  let state: S = {};
  /** The UI's live state (the engine replaces arrays as it edits them, so always read it fresh). */
  const live = (): S => (typeof window !== "undefined" && (window as any).__itqan?.S) || state;
  let own: Own | null = null;
  let role: string | null = null;
  const urlCache = new Map<string, { url: string; until: number }>();

  const api = async (path: string, body?: unknown) => {
    const r = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "error"), { code: j.error || "error" });
    return j;
  };

  /* -------- writes by path (same paths as the original app) -------- */
  async function write(path: string, data: any) {
    if (!own) return;
    const [kind, id] = [path.split("/")[0], path.split("/").slice(1).join("/")];
    if (role === "student") return studentWrite(path, data);
    switch (path === "itqan/settings" ? "settings" : path === "itqan/skills" ? "skills" : path === "itqan/bank" ? "bank" : path === "people/roster" ? "roster" : path === "behavior/log" ? "behavior" : path === "behavior/stars" ? "stars" : kind) {
      case "settings": {
        const r = settingsToRows(data, own.school_id, own.teacher_id);
        check(await sb.from("schools").update({ name: r.school.name, region: r.school.region, logo: r.school.logo, logo2: r.school.logo2 }).eq("id", own.school_id));
        const { id: _i, school_id: _s, ...t } = r.teacher;
        check(await sb.from("teachers").update(t).eq("id", own.teacher_id));
        await upsert(sb, "class_groups", groupsToRows(data.groups || null, (live().stars || {}).g || {}, own, [...new Set((live().roster || []).map((s: S) => s.cls))] as string[]), "class_id,idx");
        return;
      }
      case "skills": {
        await upsert(sb, "subjects", subjectsToRows(data.subjects || [], own.school_id), "id");
        const rows = skillsToRows(data.list, own);
        await upsert(sb, "skills", rows, "id");
        return prune(sb, "skills", { teacher_id: own.teacher_id }, "id", rows.map((r) => r.id));
      }
      case "bank": {
        const rows = questionsToRows(data.list, own);
        await upsert(sb, "questions", rows, "id");
        return prune(sb, "questions", { teacher_id: own.teacher_id }, "id", rows.map((r) => r.id));
      }
      case "qimg": return upsert(sb, "qimg", qimgToRows({ [id]: data.data }, own), "id");
      case "roster": {
        const { classes, students } = rosterToRows(data.list, own);
        await upsert(sb, "classes", classes, "id");
        await upsert(sb, "students", students, "id");
        await prune(sb, "students", { teacher_id: own.teacher_id }, "id", students.map((s) => s.id));
        const pins = data.list.filter((s: S) => s.nid).map((s: S) => ({ id: s.id, nid: s.nid }));
        if (pins.length) {
          const r = await api("/api/students/pins", { items: pins });
          data.list.forEach((s: S) => { if (s.nid) { if (!r.duplicates.includes(s.id)) s.hasPin = true; delete s.nid; } });
          (live().roster || []).forEach((s: S) => { if (s.nid) { s.hasPin = !r.duplicates.includes(s.id); delete s.nid; } });
          if (r.duplicates.length) throw { message: `رقم الهوية مسجّل لطالبة أخرى (${r.duplicates.length}). راجعي القائمة.` };
        }
        return;
      }
      case "tests": {
        const sids = new Set<string>((live().roster || []).map((s: S) => s.id));
        const r = testToRows(data, own, sids);
        await upsert(sb, "tests", [r.test], "id");
        await upsert(sb, "test_results", r.results, "test_id,student_id");
        return prune(sb, "test_results", { test_id: data.id }, "student_id", r.results.map((x) => x.student_id));
      }
      case "improve": {
        const sids = new Set<string>((live().roster || []).map((s: S) => s.id));
        const r = impToRows(data, own, sids);
        await upsert(sb, "improvement_rounds", [r.round], "id");
        await upsert(sb, "improvement_items", r.items, "round_id,student_id");
        return prune(sb, "improvement_items", { round_id: data.id }, "student_id", r.items.map((x) => x.student_id));
      }
      case "sheets": {
        const key = data.id;
        const sentAt = (sid: string, k: string) => {
          const a = (live().acks || {})[sid] || {};
          if (k.endsWith("_g")) { const m = (live().imps || {})[k.slice(0, -2)]; return m ? ((a.sent || {})[m.base]?.impg || {})[m.id] || null : null; }
          return (a.sheet || {})[k]?.at || null;
        };
        const rows = sheetsToRows(key, data.map || {}, own, sentAt, (sid) => (live().sheetPages || {})[(data.map || {})[sid]] || []);
        await upsert(sb, "sheets", rows, "student_id,key");
        return prune(sb, "sheets", { teacher_id: own.teacher_id, key }, "student_id", rows.map((r) => r.student_id));
      }
      case "acks": return teacherAck(id, data);
      case "behavior": {
        const seen = (bid: string) => { for (const a of Object.values(live().acks || {}) as S[]) { const b = (a.beh || []).find((x: S) => x.id === bid); if (b) return b.seen || null; } return null; };
        const rows = behaviorToRows(data.list, own, seen);
        await upsert(sb, "behavior_events", rows, "id");
        return prune(sb, "behavior_events", { teacher_id: own.teacher_id }, "id", rows.map((r) => r.id));
      }
      case "stars": {
        const s = data.s || {};
        for (const st of live().roster || []) {
          const n = +s[st.id] || 0;
          if (n !== (st._stars ?? 0)) { check(await sb.from("students").update({ stars: n }).eq("id", st.id)); st._stars = n; }
        }
        await upsert(sb, "class_groups", groupsToRows((live().settings || {}).groups || null, data.g || {}, own, [...new Set((live().roster || []).map((x: S) => x.cls))] as string[]), "class_id,idx");
        return;
      }
      default: return; // private/* (the old local password) has no meaning here
    }
  }

  async function teacherAck(sid: string, a: S) {
    const r = ackToRows(sid, a, own!);
    await upsert(sb, "acks", r.acks, "student_id,key");
    await prune(sb, "acks", { student_id: sid }, "key", r.acks.map((x) => x.key));
    await upsert(sb, "notes", r.notes.filter((n) => n.by === "t"), "id");
    await upsert(sb, "sends", r.sends, "student_id,test_id");
    await prune(sb, "sends", { student_id: sid }, "test_id", r.sends.map((x) => x.test_id));
    await upsert(sb, "perf_tasks", r.perf_tasks.map(({ ai_eval, ...t }) => t), "student_id,test_id"); // the AI evaluation is written by the server
    await prune(sb, "perf_tasks", { student_id: sid }, "test_id", r.perf_tasks.map((x) => x.test_id));
    for (const [key, at] of Object.entries(r.sheetSent)) check(await sb.from("sheets").update({ sent_at: at }).eq("student_id", sid).eq("key", key));
    // sheets that were withdrawn
    const { data: sent } = await sb.from("sheets").select("key").eq("student_id", sid).not("sent_at", "is", null);
    for (const x of sent || []) if (!(x.key in r.sheetSent)) check(await sb.from("sheets").update({ sent_at: null }).eq("student_id", sid).eq("key", x.key));
  }

  /** Student / parent: may only acknowledge, reply with a note, and confirm behaviour notes. */
  async function studentWrite(path: string, a: S) {
    if (!path.startsWith("acks/")) return;
    const sid = path.slice(5), r = ackToRows(sid, a, own!);
    if (r.acks.length) check(await sb.from("acks").upsert(r.acks, { onConflict: "student_id,key", ignoreDuplicates: true }));
    const mine = r.notes.filter((n) => n.by === "p");
    if (mine.length) check(await sb.from("notes").upsert(mine, { onConflict: "id", ignoreDuplicates: true }));
    for (const [bid, seen] of Object.entries(r.behSeen)) if (seen) check(await sb.from("behavior_events").update({ parent_seen_at: seen }).eq("id", bid).is("parent_seen_at", null));
  }

  /* -------- offline queue (teacher): the latest version of each document is kept until it is sent -------- */
  const queue = (): Record<string, { op: "set" | "del"; data?: any }> => { try { return JSON.parse(localStorage.getItem(QKEY) || "{}"); } catch { return {}; } };
  const saveQueue = (q: Record<string, unknown>) => { try { if (Object.keys(q).length) localStorage.setItem(QKEY, JSON.stringify(q)); else localStorage.removeItem(QKEY); } catch { /* storage full: stays in memory */ } };
  const isNetwork = (e: any) => e instanceof TypeError || /fetch|network|Failed to fetch/i.test(String(e?.message || e));
  let flushing = false;
  async function flush() {
    if (flushing || !navigator.onLine) return;
    flushing = true;
    try {
      const q = queue();
      for (const [path, it] of Object.entries(q)) {
        try { if (it.op === "set") await write(path, it.data); else await remove(path); delete q[path]; saveQueue(q); }
        catch (e) { if (isNetwork(e)) break; delete q[path]; saveQueue(q); console.error("queued write failed", path); }
      }
      Store.offline = Object.keys(queue()).length > 0;
    } finally { flushing = false; }
  }
  if (typeof window !== "undefined") window.addEventListener("online", () => flush().then(() => (window as any).__itqan?.render?.()));

  async function remove(path: string) {
    if (!own || role !== "teacher") return;
    const [kind, ...rest] = path.split("/"), id = rest.join("/");
    if (kind === "tests") check(await sb.from("tests").delete().eq("id", id));
    else if (kind === "improve") check(await sb.from("improvement_rounds").delete().eq("id", id));
    else if (kind === "qimg") check(await sb.from("qimg").delete().eq("id", id));
    else if (kind === "acks") {
      for (const t of ["acks", "notes", "sends", "perf_tasks"]) check(await sb.from(t).delete().eq("student_id", id));
      check(await sb.from("sheets").update({ sent_at: null }).eq("student_id", id));
    }
  }

  const chains: Record<string, Promise<unknown>> = {};
  const serial = (path: string, fn: () => Promise<unknown>) => (chains[path] = (chains[path] || Promise.resolve()).catch(() => {}).then(fn));

  const Store: any = {
    imgOK: true, dl: null, offline: false, mfaOn: false,
    set: (path: string, data: any) => serial(path, async () => {
      const copy = JSON.parse(JSON.stringify(data));
      try { await write(path, data); }
      catch (e) {
        if (!isNetwork(e) || role !== "teacher") throw e;
        const q = queue(); q[path] = { op: "set", data: copy }; saveQueue(q); Store.offline = true;
      }
    }),
    del: (path: string) => serial(path, async () => {
      try { await remove(path); }
      catch (e) { if (!isNetwork(e)) throw e; const q = queue(); q[path] = { op: "del" }; saveQueue(q); Store.offline = true; }
    }),

    async whoAmI() { const r = await api("/api/student-login"); return r.role ? r : null; },
    publicStats: () => api("/api/public-stats"),

    async load(asRole: string) {
      role = asRole;
      if (asRole === "student") {
        const d = await api("/api/me");
        own = { school_id: d.schoolId, teacher_id: "" };
        state = d;
        return d;
      }
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("auth");
      const { data: teacher } = await sb.from("teachers").select("*").eq("id", user.id).single();
      own = { school_id: teacher.school_id, teacher_id: teacher.id };
      const f = { teacher_id: teacher.id };
      const [school, subjects, classes, students, skills, questions, qimg, tests, test_results, rounds, items, sheets, sends, perf_tasks, task_submissions, behavior_events, class_groups] = await Promise.all([
        sb.from("schools").select("*").eq("id", teacher.school_id).single().then((r: any) => r.data),
        allRows(sb, "subjects", { school_id: teacher.school_id }), allRows(sb, "classes", f),
        allRows(sb, "students", f, "id, school_id, teacher_id, class_id, seat_no, name, stars, sort, has_pin"),
        allRows(sb, "skills", f), allRows(sb, "questions", f), allRows(sb, "qimg", f), allRows(sb, "tests", f), allRows(sb, "test_results", f),
        allRows(sb, "improvement_rounds", f), allRows(sb, "improvement_items", f), allRows(sb, "sheets", f), allRows(sb, "sends", f),
        allRows(sb, "perf_tasks", f), allRows(sb, "task_submissions"), allRows(sb, "behavior_events", f), allRows(sb, "class_groups", f),
      ]);
      const [acks, notes] = await Promise.all([allRows(sb, "acks"), allRows(sb, "notes")]);
      const st = rowsToState({ school, teacher, subjects, classes, students, skills, questions, qimg, tests, test_results, improvement_rounds: rounds, improvement_items: items, sheets, sends, perf_tasks, task_submissions, acks, notes, behavior_events, class_groups });
      const pin = new Map(students.map((s: any) => [s.id, s]));
      st.roster.forEach((s: S) => { const r: any = pin.get(s.id); s.hasPin = !!r?.has_pin; s._stars = r?.stars || 0; });
      const { data: f2 } = await sb.auth.mfa.listFactors();
      Store.mfaOn = !!(f2?.totp || []).find((x: any) => x.status === "verified");
      state = { ...st, imps: st.imps };
      flush();
      return { ...st, imps: st.imps };
    },

    /* ---- sign-in ---- */
    async studentLogin(pin: string) {
      const r = await fetch("/api/student-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { code: r.status === 429 ? "rate" : "bad" };
      return j;
    },
    async signIn(email: string, password: string) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw { message: "البريد أو كلمة المرور غير صحيحة." };
      const { data: { user } } = await sb.auth.getUser();
      const { data: t } = await sb.from("teachers").select("id").eq("id", user!.id).maybeSingle();
      if (!t) return { setup: true }; // first sign-in: the import screen decides (the server checks who may import)
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const { data: f } = await sb.auth.mfa.listFactors();
        const factor = (f?.totp || []).find((x: any) => x.status === "verified");
        if (factor) return { mfa: true, factorId: factor.id };
      }
      return { mfa: false };
    },
    async mfaVerify(factorId: string, code: string) {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw { message: "الرمز غير صحيح أو انتهت صلاحيته." };
      Store.mfaOn = true;
    },
    async mfaEnroll() {
      const { data: old } = await sb.auth.mfa.listFactors();
      for (const f of (old?.all || []).filter((x: any) => x.status !== "verified")) await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Itqan" });
      if (error || !data) throw { message: "تعذّر بدء التفعيل." };
      return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
    },
    async mfaDisable() {
      const { data } = await sb.auth.mfa.listFactors();
      for (const f of data?.totp || []) { const { error } = await sb.auth.mfa.unenroll({ factorId: f.id }); if (error) throw { message: "سجّلي الدخول من جديد بالرمز ثم أعيدي المحاولة." }; }
      Store.mfaOn = false;
    },
    async changePassword(pw: string) { const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw { message: error.message }; },
    async resetPassword(email: string) { await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset` }); },
    async signOut() { await sb.auth.signOut(); own = null; role = null; state = {}; },

    /** Sends the old app's data file (compressed) to the server, which imports it. */
    async importFile(file: File) {
      const gz = await new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
      const r = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/gzip" }, body: gz });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { message: r.status === 403 ? "هذا الحساب غير مسموح له بالاستيراد. تأكدي من البريد المسجَّل في إعدادات الموقع." : j.error === "file" ? "الملف ليس ملف بيانات إتقان." : "تعذّر الاستيراد. حاولي مرة أخرى." };
      return j;
    },

    /* ---- national ID numbers: only the server can match them ---- */
    async matchPins(pins: string[]) { if (!pins.length) return {}; return (await api("/api/students/match", { pins })).map; },
    async setPins(items: { id: string; nid: string }[]) { const r = await api("/api/students/pins", { items }); if (r.duplicates.length) throw { message: "رقم الهوية مسجّل لطالبة أخرى." }; return r; },

    /* ---- files ---- */
    async uploadSheet(blobs: Blob[], sid: string, key: string) {
      const stamp = Date.now().toString(36), out: string[] = [];
      for (let i = 0; i < blobs.length; i++) {
        const path = `${own!.school_id}/student/${sid}/${key}/${stamp}-${i + 1}.jpg`;
        const j = await toJpegBase64(blobs[i], 2200);
        const bytes = Uint8Array.from(atob(j.data), (c) => c.charCodeAt(0));
        check(await sb.storage.from("sheets").upload(path, bytes, { contentType: "image/jpeg", upsert: true }));
        out.push(path);
      }
      return out;
    },
    async uploadSubmission(file: File, sid: string, tid: string) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
      const path = `${own!.school_id}/student/${sid}/task-${tid}/${Date.now().toString(36)}.${ext}`;
      check(await sb.storage.from("submissions").upload(path, file, { contentType: file.type || "application/octet-stream" }));
      return path;
    },
    async submitTask(o: { sid: string; tid: string; taskId: string; sub: S; frames: Blob[]; kind: string; note: string; dur: number }) {
      const fd = new FormData();
      fd.append("meta", JSON.stringify({ taskId: o.taskId, sub: o.sub, kind: o.kind, note: o.note, dur: o.dur }));
      for (const f of o.frames) { const j = await toJpegBase64(f, 1500); fd.append("frames", new Blob([Uint8Array.from(atob(j.data), (c) => c.charCodeAt(0))], { type: "image/jpeg" }), "f.jpg"); }
      const r = await fetch("/api/task-submit", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw { code: j.error || "error", message: j.error === "rate_limited" ? "محاولات كثيرة اليوم. حاولي غدًا." : "تعذّر تسليم العمل. حاولي مرة أخرى." };
      return j.ev;
    },
    /** The audit log (read-only for the teacher, newest first). */
    async auditLog() {
      const { data, error } = await sb.from("audit_log").select("at, actor_role, entity, action, test_id, student_id, detail").order("at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data || [];
    },
    /** Short-lived links for a list of stored files: {"bucket:path": url}. */
    async signedUrls(items: { bucket: string; path: string }[]) {
      if (!items.length) return {};
      const out: Record<string, string> = {};
      for (const c of chunks(items, 60)) Object.assign(out, (await api("/api/signed", { items: c })).urls);
      return out;
    },
    /** Fills <img>/<a> elements marked data-sb (bucket) + data-path with short-lived signed links. */
    async hydrate(root: HTMLElement | null, force?: boolean) {
      if (!root) return;
      const els = [...root.querySelectorAll<HTMLElement>("[data-sb][data-path]")].filter((e) => force || !(e.getAttribute("src") || e.getAttribute("href")));
      if (!els.length) return;
      const need = new Map<string, { bucket: string; path: string }>();
      els.forEach((e) => { const k = `${e.dataset.sb}:${e.dataset.path}`, c = urlCache.get(k); if (force || !c || c.until < Date.now()) need.set(k, { bucket: e.dataset.sb!, path: e.dataset.path! }); });
      if (need.size) {
        try {
          const r = await api("/api/signed", { items: [...need.values()] });
          Object.entries(r.urls as Record<string, string>).forEach(([k, url]) => urlCache.set(k, { url, until: Date.now() + (r.ttl - 60) * 1000 }));
        } catch { /* shown as a note by the image error handler */ }
      }
      els.forEach((e) => {
        const c = urlCache.get(`${e.dataset.sb}:${e.dataset.path}`);
        if (!c) { if (e.tagName === "IMG") (e as HTMLImageElement).src = "data:,"; return; }
        if (e.tagName === "IMG") (e as HTMLImageElement).src = c.url; else e.setAttribute("href", c.url);
      });
    },
  };

  /* ---- AI (teacher): the original prompts, answered on the server ---- */
  const toImages = async (list: any[] = []) => Promise.all(list.map((x) => toJpegBase64(x)));
  const sample: any = async (prompt: string, opt: { onText?: (o: { text: string }) => void } = {}) => {
    const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, stream: true }) });
    if (!r.ok || !r.body) throw { code: r.status === 429 ? "rate_limited" : "ai", message: r.status === 429 ? undefined : "تعذّر الوصول إلى الذكاء الاصطناعي الآن." };
    const rd = r.body.getReader(), dec = new TextDecoder();
    let text = "";
    for (;;) { const { done, value } = await rd.read(); if (done) break; text += dec.decode(value, { stream: true }); opt.onText?.({ text }); }
    return { text };
  };
  sample.json = async (prompt: string, opt: { images?: any[] } = {}) => {
    const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, json: true, images: await toImages(opt.images) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { code: j.error === "invalid_json" ? "invalid_json" : j.error === "rate_limited" ? "rate_limited" : "ai", message: j.error === "ai" ? "تعذّر الوصول إلى الذكاء الاصطناعي الآن." : undefined };
    return j.json;
  };
  Store.sample = sample;
  return Store;
}

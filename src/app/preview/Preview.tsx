"use client";
import { useEffect } from "react";

export default function Preview() {
  useEffect(() => {
    (async () => {
      const { boot } = await import("@/engine/itqan");
      const data = await (await fetch("/api/preview-data")).json();
      const role = new URLSearchParams(location.search).get("as") || "teacher";
      const writes: unknown[] = ((window as any).__writes = []);
      const sample: any = async (_p: string, o: any = {}) => { const text = "اقتراح تجريبي."; o.onText?.({ text }); return { text }; };
      sample.json = async () => ({ title: "مهمة تجريبية", desc: "وصف", del: "img", rubric: [{ c: "الدقة", max: 5, lv: ["أ", "ب", "ج"] }] });
      const Store = {
        imgOK: true, dl: null, offline: false, mfaOn: false, sample,
        set: async (p: string, d: unknown) => { writes.push(["set", p, JSON.parse(JSON.stringify(d))]); },
        del: async (p: string) => { writes.push(["del", p]); },
        whoAmI: async () => (role === "none" ? null : { role, sid: role === "student" ? data.roster[3].id : null }),
        publicStats: async () => ({ n: 39, meanPctBefore: 68.2, meanPctAfter: 80.1, sdBefore: 3.1, sdAfter: 2.2, improvedPct: 90, settings: { school: data.settings.school } }),
        load: async () => JSON.parse(JSON.stringify(data)),
        hydrate: async () => {}, matchPins: async () => ({}), setPins: async () => ({ saved: 1, duplicates: [] }),
        signIn: async () => ({ mfa: false }), signOut: async () => {}, studentLogin: async () => ({ sid: data.roster[3].id }),
        uploadSheet: async () => ["x/student/s/k/1.jpg"], uploadSubmission: async () => "p", submitTask: async () => ({ total: 3, scores: [], fb: "", good: [], next: [] }),
        mfaEnroll: async () => ({ id: "f", qr: "", secret: "S" }), mfaVerify: async () => {}, mfaDisable: async () => {}, changePassword: async () => {}, resetPassword: async () => {},
      };
      boot(Store);
    })();
  }, []);
  return (<><div id="app"></div><div id="modal"></div><div id="toast" role="status" aria-live="polite"></div></>);
}

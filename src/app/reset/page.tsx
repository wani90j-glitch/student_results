"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Page reached from the "set your password" e-mail (first invitation or forgotten password). */
export default function Reset() {
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), a = String(f.get("a")), b = String(f.get("b"));
    if (a.length < 10) return setMsg("كلمة المرور 10 خانات على الأقل.");
    if (a !== b) return setMsg("الكلمتان غير متطابقتين.");
    const { error } = await supabaseBrowser().auth.updateUser({ password: a });
    if (error) return setMsg("انتهت صلاحية الرابط. اطلبي رابطًا جديدًا من «نسيت كلمة المرور».");
    setDone(true);
  }
  return (
    <div id="app">
      <div className="landing" style={{ maxWidth: 480, margin: "40px auto" }}>
        <form className="door" onSubmit={submit}>
          <b>تعيين كلمة المرور</b>
          {done ? (
            <span>حُفظت كلمة المرور. <Link href="/">ادخلي إلى المنصة</Link></span>
          ) : (
            <>
              <label className="fld">كلمة المرور الجديدة<input name="a" type="password" autoComplete="new-password" minLength={10} required /></label>
              <label className="fld">تأكيد كلمة المرور<input name="b" type="password" autoComplete="new-password" minLength={10} required /></label>
              <small className="err">{msg}</small>
              <div className="row end"><button className="btn" type="submit">حفظ</button></div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

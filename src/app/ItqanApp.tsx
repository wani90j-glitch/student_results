"use client";
import { useEffect } from "react";

/** Mounts the Itqan interface (ported from the original app) and hands it the database-backed store. */
export default function ItqanApp() {
  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ boot }, { createStore }] = await Promise.all([import("@/engine/itqan"), import("@/engine/store")]);
      if (alive) boot(createStore());
    })();
    return () => { alive = false; };
  }, []);
  return (
    <>
      <div id="app"><div className="center"><div className="mark big">✓</div><p>جارٍ فتح منصة إتقان…</p></div></div>
      <div id="modal"></div>
      <div id="toast" role="status" aria-live="polite"></div>
    </>
  );
}

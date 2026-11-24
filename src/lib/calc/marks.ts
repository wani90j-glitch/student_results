/** Reading marks from Excel cells or AI-read answer sheets. */
import { isAuto, qMax } from "./core";
import type { Question } from "./types";

export const LETTERS = ["أ", "ب", "ج", "د"];

/** Arabic name normalisation used to match names across files. */
export const norm = (s: string) =>
  String(s)
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

export const clampMark = (v: number | string, q: Question) => Math.max(0, Math.min(qMax(q), Math.round((+v || 0) * 2) / 2));

/** Turns one read value (letter, tick, 0/1 or a number) into the mark for that question; null when it cannot be read. */
export function markOf(v: unknown, q: Question): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (s === "") return null;
  if (!isAuto(q)) return /^\d+(\.\d+)?$/.test(s) ? clampMark(s, q) : null;
  if (q.type === "mc") {
    if (/^(1|✓|صح|صحيح|true)$/i.test(s)) return 1;
    if (/^(0|✗|x|×|خطأ|خطا|false)$/i.test(s)) return 0;
    let k = LETTERS.indexOf(s.replace(/^[إآا]$/, "أ"));
    if (k < 0) k = "ABCD".indexOf(s.toUpperCase());
    return k < 0 ? null : k === q.ans ? 1 : 0;
  }
  if (/^(1|0)$/.test(s)) return +s;
  const yes = /^(✓|✔|صح|صحيح|ص|a|true)$/i.test(s), no = /^(✗|✘|x|×|خطأ|خطا|خ|b|false)$/i.test(s);
  return yes || no ? ((yes ? 0 : 1) === q.ans ? 1 : 0) : null;
}

/** Which option a read answer points to: 0–3 for multiple choice (أ ب ج د / A B C D), 0 = true / 1 = false for true–false; null when unknown. */
export function answerIndex(v: unknown, q: Question): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (q.type === "mc") {
    let k = LETTERS.indexOf(s.replace(/^[إآا]$/, "أ"));
    if (k < 0) k = "ABCD".indexOf(s.toUpperCase());
    return k < 0 ? null : k;
  }
  if (q.type === "tf") {
    if (/^(✓|✔|صح|صحيح|ص|a|true)$/i.test(s)) return 0;
    if (/^(✗|✘|x|×|خطأ|خطا|خ|b|false)$/i.test(s)) return 1;
  }
  return null;
}

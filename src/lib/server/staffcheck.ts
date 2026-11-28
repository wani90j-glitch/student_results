import "server-only";
import { caller } from "@/lib/supabase/server";

/** The signed-in principal of a school (active), or null. */
export async function principal() {
  const c = await caller();
  if (c.role !== "staff" || c.staff.role !== "principal") return null;
  return { ...c, schoolId: c.staff.school_id as string };
}

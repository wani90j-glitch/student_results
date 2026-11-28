import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/** Acts as the signed-in user: every query goes through Row Level Security. */
export async function supabaseUser() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: "lax" })),
    },
  });
}

/** Service role: bypasses RLS. Only used after the caller has been checked, and never sent to the browser. */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Role = "teacher" | "student" | "guardian" | "staff" | null;
export interface StudentRecord { id: string; school_id: string; teacher_id: string; class_id: string; name: string }

/**
 * Who is calling:
 *  - "student": her records (one per teacher who has her), read through RLS;
 *  - "guardian": the records of each daughter;
 *  - "teacher": with two-step verification done if she enabled it;
 *  - "staff": principal / deputies / counselor of a subscribed school (plus their role and school).
 */
export async function caller() {
  const sb = await supabaseUser();
  const { data: { user } } = await sb.auth.getUser();
  const none = { sb, user, role: null as Role, sid: null as string | null, records: [] as StudentRecord[], teacher: null as any, staff: null as any };
  if (!user) return none;
  const kind = user.app_metadata?.role;
  if (kind === "student" || kind === "guardian") {
    const { data } = await sb.from("students").select("id, school_id, teacher_id, class_id, name");
    const records = (data || []) as StudentRecord[];
    if (!records.length) return none;
    return { ...none, role: kind as Role, records, sid: records[0].id, student: records[0] };
  }
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") return none;
  const { data: teacher } = await sb.from("teachers").select("id, school_id, display_name").eq("id", user.id).maybeSingle();
  if (teacher) return { ...none, role: "teacher" as Role, teacher };
  const { data: m } = await sb.from("school_members").select("school_id, role, status").eq("user_id", user.id).eq("status", "active").neq("role", "teacher").limit(1).maybeSingle();
  if (m) return { ...none, role: "staff" as Role, staff: m };
  return none;
}

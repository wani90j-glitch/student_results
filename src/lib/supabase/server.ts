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

/** Who is calling: a teacher (with two-step verification done if she enabled it) or a student. */
export async function caller() {
  const sb = await supabaseUser();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { sb, user: null, role: null as null, sid: null as string | null, teacher: null as any };
  if (user.app_metadata?.role === "student") {
    const { data } = await sb.from("students").select("id, school_id, teacher_id, class_id").eq("auth_user_id", user.id).maybeSingle();
    return { sb, user, role: data ? ("student" as const) : null, sid: data?.id ?? null, student: data, teacher: null };
  }
  const { data: teacher } = await sb.from("teachers").select("id, school_id").eq("id", user.id).maybeSingle();
  if (!teacher) return { sb, user, role: null, sid: null, teacher: null };
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") return { sb, user, role: null, sid: null, teacher: null };
  return { sb, user, role: "teacher" as const, sid: null, teacher };
}

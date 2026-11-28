import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseUser } from "@/lib/supabase/server";

/** A sign-in identity with no usable e-mail or password (students and parents sign in with their code through the server). */
export async function createCodeUser(admin: any, kind: "student" | "guardian") {
  const domain = kind === "student" ? "students.itqan.invalid" : "parents.itqan.invalid";
  const { data, error } = await admin.auth.admin.createUser({ email: `${kind}-${randomUUID()}@${domain}`, email_confirm: true, app_metadata: { role: kind } });
  if (error || !data?.user) throw new Error("could not create sign-in identity");
  return data.user.id as string;
}

/** Opens a session (cookies) for an existing auth user, after the server has checked the code. */
export async function signInAs(admin: any, authUserId: string) {
  const { data: u } = await admin.auth.admin.getUserById(authUserId);
  if (!u?.user?.email) throw new Error("no such user");
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (error || !link?.properties?.hashed_token) throw new Error("link");
  const sb = await supabaseUser();
  await sb.auth.signOut().catch(() => {});
  const { error: e2 } = await sb.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (e2) throw new Error("verify");
}

"use server";

import { redirect } from "next/navigation";
import { isSetupIncomplete } from "@027apps/core/instance/api.js";
import { getInfra } from "@/lib/api/door";
import { postLoginPath } from "@/lib/post-login";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server action: email + password sign-in. Credentials never reach client JS:
 * the SSR client sets the `HttpOnly`/`Secure`/`SameSite` cookies.
 */
export async function signInAction(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=invalid_credentials`);
  }

  // Pending setup steps win over the panel: finish the wizard first.
  const { settingsDeps } = await getInfra();
  redirect(postLoginPath(await isSetupIncomplete(settingsDeps)));
}

/** Server action: drops the session cookies and returns to the login screen. */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

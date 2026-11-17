"use server";

import { redirect } from "next/navigation";
import { isActiveProfile } from "@/lib/active-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NEXT = "/reset-password";

/**
 * Consumes the recovery token only after the user clicks: a GET that verified
 * the OTP would let mail-link scanners burn the single-use token (S2).
 */
export async function confirmRecoveryAction(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "");
  const next = String(formData.get("next") ?? "");

  if (type !== "recovery" || next !== NEXT || tokenHash.length === 0) {
    redirect("/forgot-password?notice=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (error) redirect("/forgot-password?notice=invalid");

  // The link outlives a deactivation: the session it just created must not.
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await isActiveProfile(data.user.id))) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/forgot-password?notice=invalid");
  }

  redirect(NEXT);
}

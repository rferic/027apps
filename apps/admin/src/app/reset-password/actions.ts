"use server";

import { redirect } from "next/navigation";
import { getInfra } from "@/lib/api/door";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;
const RESET_LIMIT = 5;
const RESET_WINDOW_MS = 5 * 60_000;

function fail(reason: string): never {
  redirect(`/reset-password?error=${reason}`);
}

async function overLimit(userId: string): Promise<boolean> {
  const { deps } = await getInfra();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / RESET_WINDOW_MS) * RESET_WINDOW_MS);
  const { count } = await deps.rateLimitStorage.increment(
    `reset:${userId}`,
    windowStart,
    new Date(windowStart.getTime() + RESET_WINDOW_MS * 2),
  );
  return count > RESET_LIMIT;
}

/**
 * Chooses the new password with the recovery session, revokes every other
 * session and closes the local one: the user goes back to login with a notice
 * (D8).
 */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < MIN_PASSWORD) fail("short");
  if (password.length > MAX_PASSWORD) fail("long");
  if (password !== confirmation) fail("mismatch");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password");
  if (await overLimit(data.user.id)) fail("rate_limited");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) fail("invalid");

  // Every other device (the app included) loses its session; the recovery
  // session is closed too and the person signs in again.
  await supabase.auth.signOut({ scope: "others" });
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=password-reset");
}

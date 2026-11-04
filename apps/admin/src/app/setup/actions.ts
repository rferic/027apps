"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SMTP_COOKIE } from "./smtp-cookie";

/** Marks the SMTP step as verified for this browsing session (1 hour). */
export async function confirmSmtpAction(): Promise<void> {
  const store = await cookies();
  store.set(SMTP_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/setup",
    maxAge: 60 * 60,
  });
  redirect("/setup");
}

/** Reopens step 3: drops the confirmation cookie so the wizard asks for the email again. */
export async function backToSmtpAction(): Promise<void> {
  const store = await cookies();
  store.set(SMTP_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/setup",
    maxAge: 0,
  });
  redirect("/setup");
}

/** Drops the session so the next sign-in mints a token with the current expiry. */
export async function signOutAndRestartAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

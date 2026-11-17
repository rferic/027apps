"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requestPasswordReset } from "@027apps/core/auth/password-recovery.js";
import { passwordRecoveryDeps } from "@/lib/password-recovery-deps";

const emailSchema = z.string().trim().email().max(320);

function clientIp(value: string | null): string {
  return value?.split(",")[0]?.trim() || "unknown";
}

/**
 * Request a recovery email. Every path ends on the same neutral page: an
 * unknown address, an invalid one and a delivered link are indistinguishable
 * in the UI.
 */
export async function requestResetAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (parsed.success) {
    const requestHeaders = await headers();
    try {
      await requestPasswordReset(await passwordRecoveryDeps(), {
        email: parsed.data,
        ip: clientIp(requestHeaders.get("x-forwarded-for")),
      });
    } catch {
      // The service is already silent; this is the last line of defence.
    }
  }
  redirect("/forgot-password?sent=1");
}

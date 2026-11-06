import { DEFAULT_MESSAGES } from "@027apps/core/errors.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";

export interface SuperAdminInput {
  email: string;
  password: string;
  displayName: string;
}

type ErrorEnvelope = {
  error?: {
    message?: string;
    details?: { fieldErrors?: Record<string, string[] | undefined> };
  };
};

/** Field-level messages shown under each input. */
export type FieldErrors = Partial<Record<"email" | "password" | "displayName", string>>;

export type SubmitResult = { ok: true } | { ok: false; message: string; fieldErrors: FieldErrors };

function fieldMessage(key: string, messages: TranslationMap): { field: keyof FieldErrors; message: string } | null {
  switch (key) {
    case "email":
      return {
        field: "email",
        message: t("Enter a valid email address, for example name@example.com.", messages),
      };
    case "password":
      return {
        field: "password",
        message: t(
          "Use at least 12 characters. A longer passphrase is safer and easier to remember.",
          messages,
        ),
      };
    case "display_name":
      return {
        field: "displayName",
        message: t("Add a display name between 1 and 80 characters.", messages),
      };
    default:
      return null;
  }
}

/** Keeps only the fields we know how to explain, with friendly wording. */
function pickKnownFields(
  raw: Record<string, string[] | undefined> = {},
  messages: TranslationMap,
): FieldErrors {
  const picked: FieldErrors = {};
  for (const [key, rawMessages] of Object.entries(raw)) {
    const known = fieldMessage(key, messages);
    if (known && rawMessages && rawMessages.length > 0) picked[known.field] = known.message;
  }
  return picked;
}

/** Turns the door's validation envelope into per-field messages plus a summary. */
function describeError(
  body: ErrorEnvelope | null,
  messages: TranslationMap,
): { message: string; fieldErrors: FieldErrors } {
  const fieldErrors = pickKnownFields(body?.error?.details?.fieldErrors, messages);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: t("Please check the highlighted fields and try again.", messages),
      fieldErrors,
    };
  }

  const message = body?.error?.message;
  if (message && Object.values(DEFAULT_MESSAGES).includes(message)) {
    return { message: t(message, messages), fieldErrors };
  }
  return {
    message: message
      ? `${t("We couldn't create the super admin. Try again.", messages)} ${t("Details: {message}", messages, { message })}`
      : t("We couldn't create the super admin. Try again.", messages),
    fieldErrors,
  };
}

/** POSTs the setup form to the door and maps non-201 to a readable message. */
export async function submitSuperAdmin(
  input: SuperAdminInput,
  messages: TranslationMap,
): Promise<SubmitResult> {
  let res: Response;
  try {
    res = await fetch("/api/v1/setup/super-admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        display_name: input.displayName,
      }),
    });
  } catch {
    // Offline, tunnel down or dev server restarting: the form must explain it
    // instead of leaving the button stuck on "Creating…".
    return {
      ok: false,
      message: t("We couldn't reach the server. Check your connection, then try again.", messages),
      fieldErrors: {},
    };
  }

  if (res.status === 201) return { ok: true };
  const body = (await res.json().catch(() => null)) as ErrorEnvelope | null;
  return { ok: false, ...describeError(body, messages) };
}

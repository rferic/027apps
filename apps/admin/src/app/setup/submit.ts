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

const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the server. Check your connection, then try again.";

const CHECK_FIELDS_MESSAGE = "Please check the highlighted fields and try again.";

const GENERIC_ERROR_MESSAGE = "We couldn't create the super admin. Try again.";

/** Friendly wording for the fields the setup door validates. */
const FIELD_MESSAGES: Record<string, { field: keyof FieldErrors; message: string }> = {
  email: { field: "email", message: "Enter a valid email address, for example name@example.com." },
  password: {
    field: "password",
    message: "Use at least 12 characters. A longer passphrase is safer and easier to remember.",
  },
  display_name: {
    field: "displayName",
    message: "Add a display name between 1 and 80 characters.",
  },
};

/** Keeps only the fields we know how to explain, with friendly wording. */
function pickKnownFields(raw: Record<string, string[] | undefined> = {}): FieldErrors {
  const picked: FieldErrors = {};
  for (const [key, messages] of Object.entries(raw)) {
    const known = FIELD_MESSAGES[key];
    if (known && messages && messages.length > 0) picked[known.field] = known.message;
  }
  return picked;
}

/** Turns the door's validation envelope into per-field messages plus a summary. */
function describeError(body: ErrorEnvelope | null): { message: string; fieldErrors: FieldErrors } {
  const fieldErrors = pickKnownFields(body?.error?.details?.fieldErrors);
  if (Object.keys(fieldErrors).length > 0) return { message: CHECK_FIELDS_MESSAGE, fieldErrors };
  return { message: body?.error?.message ?? GENERIC_ERROR_MESSAGE, fieldErrors };
}

/** POSTs the setup form to the door and maps non-201 to a readable message. */
export async function submitSuperAdmin(input: SuperAdminInput): Promise<SubmitResult> {
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
    return { ok: false, message: NETWORK_ERROR_MESSAGE, fieldErrors: {} };
  }

  if (res.status === 201) return { ok: true };
  const body = (await res.json().catch(() => null)) as ErrorEnvelope | null;
  return { ok: false, ...describeError(body) };
}

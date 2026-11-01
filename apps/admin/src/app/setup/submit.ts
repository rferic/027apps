export interface SuperAdminInput {
  email: string;
  password: string;
  displayName: string;
}

/** POSTs the setup form to the door and maps non-201 to a readable message. */
export async function submitSuperAdmin(
  input: SuperAdminInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch("/api/v1/setup/super-admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      display_name: input.displayName,
    }),
  });
  if (res.status === 201) return { ok: true };
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, message: body?.error?.message ?? "Setup failed" };
}

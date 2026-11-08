import {
  failureFrom,
  readMutation,
  withoutBody,
  type MutationFailure,
  type MutationResult,
} from "@/lib/mutation-result";

export type CreateCategoryResult = { ok: true; id?: string } | MutationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readId(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.category)) return undefined;
  return typeof value.category.id === "string" && value.category.id.length > 0
    ? value.category.id
    : undefined;
}

async function bodyOrFailure(res: Response): Promise<MutationFailure> {
  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  try {
    return failureFrom(JSON.parse(await res.text()), headerRequestId);
  } catch {
    return withoutBody(headerRequestId);
  }
}

/**
 * Same-origin fetch from the browser: cookies travel automatically, so the
 * panel never adds an Authorization header or a service token to the bundle.
 */
export async function createCategory(
  input: { name: string; slug?: string },
  fetcher: typeof fetch = fetch,
): Promise<CreateCategoryResult> {
  const body: { name: string; slug?: string } = { name: input.name };
  if (input.slug) body.slug = input.slug;

  let res: Response;
  try {
    res = await fetcher("/api/v1/user-categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false };
  }

  if (!res.ok) return bodyOrFailure(res);
  if (res.status === 204) return { ok: true };

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await res.text());
  } catch {
    return withoutBody(headerRequestId);
  }
  if (!isRecord(parsed)) return withoutBody(headerRequestId);
  const id = readId(parsed);
  return id ? { ok: true, id } : { ok: true };
}

export async function renameCategory(
  id: string,
  name: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/user-categories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name }),
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

export async function deleteCategory(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/user-categories/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

export async function addCategoryMember(
  categoryId: string,
  userId: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(
      `/api/v1/user-categories/${encodeURIComponent(categoryId)}/members/${encodeURIComponent(userId)}`,
      { method: "POST", credentials: "same-origin" },
    );
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

export async function removeCategoryMember(
  categoryId: string,
  userId: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(
      `/api/v1/user-categories/${encodeURIComponent(categoryId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE", credentials: "same-origin" },
    );
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

export async function assignCategoryModule(
  categoryId: string,
  moduleKey: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(
      `/api/v1/user-categories/${encodeURIComponent(categoryId)}/modules/${encodeURIComponent(moduleKey)}`,
      { method: "POST", credentials: "same-origin" },
    );
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

export async function unassignCategoryModule(
  categoryId: string,
  moduleKey: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(
      `/api/v1/user-categories/${encodeURIComponent(categoryId)}/modules/${encodeURIComponent(moduleKey)}`,
      { method: "DELETE", credentials: "same-origin" },
    );
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

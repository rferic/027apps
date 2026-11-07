import { describe, expect, it, vi } from "vitest";
import {
  addCategoryMember,
  assignCategoryModule,
  createCategory,
  deleteCategory,
  removeCategoryMember,
  renameCategory,
  unassignCategoryModule,
} from "./category-mutations";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function call(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as unknown as [string, RequestInit];
}

describe("createCategory", () => {
  it("POSTs the name and the optional slug same-origin", async () => {
    const fetcher = vi.fn(async () => json({ category: { id: "c1" } }, 201));

    await expect(createCategory({ name: "Familia", slug: "familia" }, fetcher)).resolves.toEqual({
      ok: true,
      id: "c1",
    });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/user-categories");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ name: "Familia", slug: "familia" });
  });

  it("omits an empty slug so the Core derives it", async () => {
    const fetcher = vi.fn(async () => json({ category: { id: "c1" } }, 201));

    await createCategory({ name: "Familia" }, fetcher);

    expect(JSON.parse(String(call(fetcher)[1].body))).toEqual({ name: "Familia" });
  });

  it("accepts a 2xx object without an id as success", async () => {
    const fetcher = vi.fn(async () => json({ category: {} }, 201));

    await expect(createCategory({ name: "Familia" }, fetcher)).resolves.toEqual({ ok: true });
  });

  it("returns the translated code and the request id on a conflict", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "conflict", request_id: "req-409" } }, 409, {
        "x-request-id": "req-header",
      }),
    );

    await expect(createCategory({ name: "Familia" }, fetcher)).resolves.toEqual({
      ok: false,
      code: "conflict",
      requestId: "req-409",
    });
  });
});

describe("renameCategory", () => {
  it("PATCHes the category endpoint with only the name", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(renameCategory("c1", " Nueva ", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/user-categories/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ name: " Nueva " });
  });
});

describe("deleteCategory", () => {
  it("DELETEs the category endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(deleteCategory("c1", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/user-categories/c1");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("same-origin");
  });
});

describe("category members", () => {
  it("POSTs a member with no body", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(addCategoryMember("c1", "u1", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/user-categories/c1/members/u1");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("DELETEs a member", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(removeCategoryMember("c1", "u1", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/user-categories/c1/members/u1");
    expect(init.method).toBe("DELETE");
  });
});

describe("category modules", () => {
  it("POSTs the module key", async () => {
    const fetcher = vi.fn(async () => json({ modules: ["expenses"] }));

    await expect(assignCategoryModule("c1", "expenses", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/user-categories/c1/modules/expenses");
    expect(init.method).toBe("POST");
  });

  it("encodes a module key with unusual characters before it reaches the URL", async () => {
    const fetcher = vi.fn(async () => json({ modules: [] }));

    await assignCategoryModule("c1", "a/b", fetcher);

    expect(call(fetcher)[0]).toBe("/api/v1/user-categories/c1/modules/a%2Fb");
  });

  it("DELETEs the module key", async () => {
    const fetcher = vi.fn(async () => json({ modules: [] }));

    await expect(unassignCategoryModule("c1", "expenses", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/user-categories/c1/modules/expenses");
    expect(init.method).toBe("DELETE");
  });
});

describe("failure handling", () => {
  it("propagates the field errors of a validation failure", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: "validation_failed",
            request_id: "req-400",
            details: { formErrors: [], fieldErrors: { name: ["Too long"] } },
          },
        },
        400,
      ),
    );

    await expect(createCategory({ name: "x" }, fetcher)).resolves.toEqual({
      ok: false,
      code: "validation_failed",
      requestId: "req-400",
      details: { formErrors: [], fieldErrors: { name: ["Too long"] } },
    });
  });

  it("degrades a network failure to a plain rejection", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(deleteCategory("c1", fetcher)).resolves.toEqual({ ok: false });
  });

  it("does not treat a 200 HTML page as success", async () => {
    const fetcher = vi.fn(async () => new Response("<!doctype html>", { status: 200 }));

    await expect(deleteCategory("c1", fetcher)).resolves.toEqual({ ok: false });
  });
});

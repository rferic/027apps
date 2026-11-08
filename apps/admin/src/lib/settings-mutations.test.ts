import { describe, expect, it, vi } from "vitest";
import { patchSettingsBatch } from "./settings-mutations";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function call(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as unknown as [string, RequestInit];
}

describe("patchSettingsBatch", () => {
  it("PATCHes one body with every update", async () => {
    const fetcher = vi.fn(async () => json({ settings: [] }));

    await expect(
      patchSettingsBatch(
        [
          { key: "instance.name", value: "Familia" },
          { key: "localization.timezone", value: "Europe/Madrid" },
        ],
        fetcher,
      ),
    ).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/settings");
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(String(init.body))).toEqual({
      updates: [
        { key: "instance.name", value: "Familia" },
        { key: "localization.timezone", value: "Europe/Madrid" },
      ],
    });
  });

  it("does not call the API without changes", async () => {
    const fetcher = vi.fn();

    await expect(patchSettingsBatch([], fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps details.key so the form can mark the failing field", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: "validation_failed",
            request_id: "req-400",
            details: { key: "localization.timezone", formErrors: ["bad zone"], fieldErrors: {} },
          },
        },
        400,
      ),
    );

    await expect(
      patchSettingsBatch([{ key: "localization.timezone", value: "Mars/Base" }], fetcher),
    ).resolves.toEqual({
      ok: false,
      code: "validation_failed",
      requestId: "req-400",
      details: { key: "localization.timezone", formErrors: ["bad zone"], fieldErrors: {} },
    });
  });

  it("treats a 204 as success and never a 2xx HTML page", async () => {
    await expect(
      patchSettingsBatch([{ key: "instance.name", value: "X" }], vi.fn(async () => new Response(null, { status: 204 }))),
    ).resolves.toEqual({ ok: true });

    await expect(
      patchSettingsBatch(
        [{ key: "instance.name", value: "X" }],
        vi.fn(async () => new Response("<html></html>", { status: 200 })),
      ),
    ).resolves.toEqual({ ok: false });
  });
});

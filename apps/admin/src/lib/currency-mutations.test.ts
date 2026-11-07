import { describe, expect, it, vi } from "vitest";
import { setCurrencyEnabled } from "./currency-mutations";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function call(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as unknown as [string, RequestInit];
}

describe("setCurrencyEnabled", () => {
  it("PATCHes the currency code with the new enabled flag", async () => {
    const fetcher = vi.fn(async () =>
      json({ currency: { code: "USD", enabled: false, isDefault: false } }),
    );

    await expect(setCurrencyEnabled("USD", false, fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/currencies/USD");
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(String(init.body))).toEqual({ enabled: false });
  });

  it("keeps the default-currency refusal", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "currency_is_default", request_id: "req-409" } }, 409),
    );

    await expect(setCurrencyEnabled("EUR", false, fetcher)).resolves.toEqual({
      ok: false,
      code: "currency_is_default",
      requestId: "req-409",
    });
  });
});

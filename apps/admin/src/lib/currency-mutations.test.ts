import { describe, expect, it, vi } from "vitest";
import { patchCurrencies } from "./currency-mutations";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function call(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as unknown as [string, RequestInit];
}

describe("patchCurrencies", () => {
  it("PATCHes the batch endpoint with every update in one body", async () => {
    const fetcher = vi.fn(async () =>
      json({ default: "EUR", currencies: [{ code: "USD", enabled: false, isDefault: false }] }),
    );

    await expect(
      patchCurrencies(
        [
          { code: "USD", enabled: false },
          { code: "SEK", enabled: false },
        ],
        fetcher,
      ),
    ).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/currencies");
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(String(init.body))).toEqual({
      updates: [
        { code: "USD", enabled: false },
        { code: "SEK", enabled: false },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for an empty change list", async () => {
    const fetcher = vi.fn();

    await expect(patchCurrencies([], fetcher)).resolves.toEqual({ ok: true });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the default-currency refusal and its request id", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "currency_is_default", request_id: "req-409" } }, 409),
    );

    await expect(
      patchCurrencies([{ code: "EUR", enabled: false }], fetcher),
    ).resolves.toEqual({
      ok: false,
      code: "currency_is_default",
      requestId: "req-409",
    });
  });
});

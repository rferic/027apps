import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const createServerClientMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("@/lib/instance-gate", () => ({ entryGate: vi.fn() }));
vi.mock("@/lib/instance-state", () => ({ readInstanceState: vi.fn() }));

import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  createServerClientMock.mockReset();
});

describe("proxy public help", () => {
  it("keeps the CSP without creating a Supabase client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await proxy(new NextRequest("http://localhost/help/firebase"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy-report-only")).toContain("default-src");
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});

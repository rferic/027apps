import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const runDueModuleJobs = vi.fn();

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({ settingsDeps: { db: {} } }),
  runInTransaction: vi.fn(),
}));

vi.mock("@027apps/core/modules/jobs.js", () => ({
  runDueModuleJobs: (...args: unknown[]) => runDueModuleJobs(...args),
}));

const original = {
  cron: process.env.CRON_SECRET,
  maintenance: process.env.MAINTENANCE_CRON_SECRET,
};

beforeEach(() => {
  runDueModuleJobs.mockReset();
  runDueModuleJobs.mockResolvedValue({ runs: [], executed: 2, failed: 1 });
  delete process.env.CRON_SECRET;
  delete process.env.MAINTENANCE_CRON_SECRET;
});

afterEach(() => {
  if (original.cron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original.cron;
  if (original.maintenance === undefined) delete process.env.MAINTENANCE_CRON_SECRET;
  else process.env.MAINTENANCE_CRON_SECRET = original.maintenance;
});

function call(token?: string): Request {
  return new Request("http://localhost/api/v1/maintenance/module-jobs", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("module jobs cron route", () => {
  it("answers 503 while no secret is configured", async () => {
    expect((await GET(call("anything"))).status).toBe(503);
    expect(runDueModuleJobs).not.toHaveBeenCalled();
  });

  it("accepts Vercel's CRON_SECRET and refuses a wrong token", async () => {
    process.env.CRON_SECRET = "cron-value";
    expect((await GET(call("wrong"))).status).toBe(401);
    const response = await GET(call("cron-value"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ executed: 2, failed: 1 });
  });

  it("keeps MAINTENANCE_CRON_SECRET working for manual calls", async () => {
    process.env.MAINTENANCE_CRON_SECRET = "manual-value";
    expect((await GET(call("manual-value"))).status).toBe(200);
  });

  it("prefers CRON_SECRET when both exist", async () => {
    process.env.CRON_SECRET = "cron-value";
    process.env.MAINTENANCE_CRON_SECRET = "manual-value";
    expect((await GET(call("manual-value"))).status).toBe(401);
    expect((await GET(call("cron-value"))).status).toBe(200);
  });
});

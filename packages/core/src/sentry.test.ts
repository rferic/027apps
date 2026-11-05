import { describe, expect, it, vi } from "vitest";
import { initSentry } from "./sentry.js";

describe("initSentry", () => {
  it("does nothing without a DSN", () => {
    const init = vi.fn();
    initSentry({ dsn: null, environment: "test" }, { init });
    expect(init).not.toHaveBeenCalled();
  });

  it("initializes with sendDefaultPii=false and the scrubber as beforeSend", () => {
    const init = vi.fn();
    initSentry({ dsn: "https://key@sentry.test/1", environment: "test" }, { init });

    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0]?.[0] as {
      dsn: string;
      environment: string;
      sendDefaultPii: boolean;
      beforeSend: (event: Record<string, unknown>) => unknown;
    };
    expect(options.dsn).toBe("https://key@sentry.test/1");
    expect(options.environment).toBe("test");
    expect(options.sendDefaultPii).toBe(false);
    expect(options.beforeSend({ tags: { status_code: "404" } })).toBeNull();
    expect(options.beforeSend({ tags: { status_code: "500" }, user: { ip: "1.2.3.4" } })).toEqual({
      tags: { status_code: "500" },
      user: {},
    });
  });
});

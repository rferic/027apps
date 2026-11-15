import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/(panel)/panel/modules/install/actions", () => ({
  installModuleAction: vi.fn(),
}));

import {
  InstallButtonView,
  installOnce,
  type InstallFailure,
} from "./module-install-button";

/** A request the test resolves by hand, to keep it in flight across both clicks. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function recordFailures() {
  const failures: InstallFailure[] = [];
  return { failures, onFailure: (failure: InstallFailure) => failures.push(failure) };
}

describe("InstallButtonView", () => {
  it("offers the install action when nothing is in flight", () => {
    const html = renderToStaticMarkup(
      <InstallButtonView pending={false} failure={null} messages={{}} onInstall={() => {}} />,
    );

    expect(html).toContain(">Install</button>");
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(html).not.toContain('role="alert"');
  });

  it("stays disabled and says it is installing while the request is pending", () => {
    const html = renderToStaticMarkup(
      <InstallButtonView pending failure={null} messages={{}} onInstall={() => {}} />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Installing…<\/button>/);
  });

  it("shows the failure message, the reason and the request id", () => {
    const html = renderToStaticMarkup(
      <InstallButtonView
        pending={false}
        failure={{
          reason: "already_installed",
          message: "This module is already installed.",
          requestId: "req-409",
        }}
        messages={{}}
        onInstall={() => {}}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t install the module.");
    expect(html).toContain("This module is already installed.");
    expect(html).toContain("req-409");
  });
});

describe("installOnce", () => {
  it("sends a single request for two clicks in a row", async () => {
    const gate = { current: false };
    const pending = deferred<{ ok: false; reason: "forbidden" } | undefined>();
    const request = vi.fn(() => pending.promise);
    const { failures, onFailure } = recordFailures();

    const first = installOnce(gate, request, onFailure, {});
    const second = installOnce(gate, request, onFailure, {});

    expect(request).toHaveBeenCalledTimes(1);

    pending.resolve(undefined);
    await Promise.all([first, second]);

    expect(failures).toEqual([]);
    expect(gate.current).toBe(false);
  });

  it("accepts a new attempt once the previous one has finished", async () => {
    const gate = { current: false };
    const request = vi.fn(async () => undefined);
    const { onFailure } = recordFailures();

    await installOnce(gate, request, onFailure, {});
    await installOnce(gate, request, onFailure, {});

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("releases the guard when the request throws", async () => {
    const gate = { current: false };
    const request = vi.fn(async () => {
      throw new Error("network down");
    });
    const { onFailure } = recordFailures();

    await expect(installOnce(gate, request, onFailure, {})).rejects.toThrow("network down");
    expect(gate.current).toBe(false);
  });

  it("reports a 409 as already installed with its request id", async () => {
    const gate = { current: false };
    const { failures, onFailure } = recordFailures();

    await installOnce(
      gate,
      async () => ({ ok: false, reason: "already_installed", requestId: "req-409" }),
      onFailure,
      {},
    );

    expect(failures).toEqual([
      {
        reason: "already_installed",
        message: "This module is already installed.",
        requestId: "req-409",
      },
    ]);
  });

  it("reports a 403 as a permission failure with its request id", async () => {
    const gate = { current: false };
    const { failures, onFailure } = recordFailures();

    await installOnce(
      gate,
      async () => ({ ok: false, reason: "forbidden", requestId: "req-403" }),
      onFailure,
      {},
    );

    expect(failures).toEqual([
      {
        reason: "forbidden",
        message: "You do not have permission to do that.",
        requestId: "req-403",
      },
    ]);
  });

  it("reports an unexpected failure with the generic message", async () => {
    const gate = { current: false };
    const { failures, onFailure } = recordFailures();

    await installOnce(
      gate,
      async () => ({ ok: false, reason: "failed", requestId: "req-500" }),
      onFailure,
      {},
    );

    expect(failures).toEqual([
      {
        reason: "failed",
        message: "Something went wrong on the server.",
        requestId: "req-500",
      },
    ]);
  });
});

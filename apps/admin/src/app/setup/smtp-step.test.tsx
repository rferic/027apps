import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SmtpStep } from "./smtp-step";

describe("SmtpStep", () => {
  it("shows the destination address and the send action", () => {
    const html = renderToStaticMarkup(<SmtpStep email="admin@example.com" />);

    expect(html).toContain("Step 3 · Email");
    expect(html).toContain("admin@example.com");
    expect(html).toContain("Send test email");
  });

  it("warns that the test arrives as a password reset and the link must not be used", () => {
    const html = renderToStaticMarkup(<SmtpStep email="admin@example.com" />);

    expect(html).toContain("“Reset your password”");
    expect(html).toContain("do not use the link");
  });

  it("explains that a local stack captures mail in Mailpit", () => {
    const html = renderToStaticMarkup(<SmtpStep email="admin@example.com" />);

    expect(html).toContain("Mailpit");
  });
});

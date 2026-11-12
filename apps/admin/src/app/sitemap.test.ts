import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("sitemap", () => {
  const entries = sitemap();

  it("lists the public pages", () => {
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://027apps.ericrf.com/",
      "https://027apps.ericrf.com/self-host",
      "https://027apps.ericrf.com/cookies",
    ]);
  });
});

describe("robots", () => {
  it("indexes the landing and keeps the panel and the API out", () => {
    const result = robots();
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rule?.allow).toBe("/");
    expect(rule?.disallow).toEqual(
      expect.arrayContaining(["/panel", "/api/", "/setup", "/invite/"]),
    );
    expect(result.sitemap).toBe("https://027apps.ericrf.com/sitemap.xml");
  });
});

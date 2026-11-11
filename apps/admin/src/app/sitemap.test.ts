import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("sitemap", () => {
  const entries = sitemap();

  it("lists both landing pages in the nine languages", () => {
    expect(entries).toHaveLength(18);
    expect(entries.map((entry) => entry.url)).toContain("https://027apps.ericrf.com/");
    expect(entries.map((entry) => entry.url)).toContain(
      "https://027apps.ericrf.com/self-host",
    );
    expect(entries.map((entry) => entry.url)).toContain(
      "https://027apps.ericrf.com/l/es/self-host",
    );
  });

  it("declares every language as an alternate of each page", () => {
    const spanish = entries.find(
      (entry) => entry.url === "https://027apps.ericrf.com/l/es",
    );
    expect(Object.keys(spanish?.alternates?.languages ?? {})).toHaveLength(9);
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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DownloadButton, DOWNLOAD_URL } from "./download-button";

describe("download button", () => {
  it("links to GitHub Releases with the localised label", () => {
    const html = renderToStaticMarkup(<DownloadButton label="Descargar para Android" />);
    expect(html).toContain(`href="${DOWNLOAD_URL}"`);
    expect(html).toContain("Descargar para Android");
    expect(html).toContain('class="btn primary"');
  });

  it("carries a decorative 16 px Android icon in currentColor", () => {
    const html = renderToStaticMarkup(<DownloadButton label="Download for Android" />);
    expect(html).toMatch(/<svg[^>]*width="16"[^>]*height="16"/);
    expect(html).toContain('fill="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/fill="#[0-9a-f]{3,8}"/i);
  });

  it("keeps the icon and the text on the same button, icon first", () => {
    const html = renderToStaticMarkup(<DownloadButton label="Download for Android" />);
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("Download for Android"));
  });
});

describe("download button version", () => {
  // Task 12: the small line under the label, taken from the release lookup.
  it("shows the version it will serve", () => {
    const html = renderToStaticMarkup(
      <DownloadButton label="Descargar para Android" version="0.16.9" />,
    );
    expect(html).toContain("0.16.9");
    expect(html).toContain('href="/download/android"');
  });

  it("omits the line when there is no release instead of inventing one", () => {
    const html = renderToStaticMarkup(<DownloadButton label="Descargar para Android" version={null} />);
    // No second line at all, rather than a made-up version.
    expect(html).not.toContain("tabular-nums");
  });
});

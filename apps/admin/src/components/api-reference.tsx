"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useEffect, useState } from "react";
import "./api-reference.css";

/**
 * Scalar is bundled locally (never a CDN, so the CSP needs no third-party
 * `script-src`) and themed with the panel's semantic tokens, light or dark.
 */

/** The panel follows the OS colour scheme; Scalar must follow the same one. */
function usePrefersDark(): boolean {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return dark;
}

export function ApiReference({ url }: { url: string }) {
  const dark = usePrefersDark();

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <ApiReferenceReact
        configuration={{
          url,
          theme: "default",
          darkMode: dark,
          forceDarkModeState: dark ? "dark" : "light",
          documentDownloadType: "none",
          withDefaultFonts: false,
        }}
      />
    </div>
  );
}

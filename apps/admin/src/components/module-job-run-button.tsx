"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runModuleJob } from "@/lib/module-mutations";

/** Runs one scheduled job now and refreshes the history. */
export function ModuleJobRunButton({
  moduleKey,
  jobKey,
  label,
  failedLabel,
}: {
  moduleKey: string;
  jobKey: string;
  label: string;
  failedLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setPending(true);
    setFailed(false);
    const result = await runModuleJob(moduleKey, jobKey);
    setPending(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="min-h-9 rounded-control border border-border px-3 text-[11px] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
      >
        {label}
      </button>
      {failed ? <span role="alert" className="text-[11px] text-destructive">{failedLabel}</span> : null}
    </span>
  );
}

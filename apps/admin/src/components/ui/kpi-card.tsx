import { cn } from "@/lib/cn";

export type KpiTone = "default" | "destructive";

const toneClasses: Record<KpiTone, string> = {
  default: "",
  destructive: "text-destructive",
};

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: KpiTone;
  className?: string;
}

export function KpiCard({ label, value, delta, tone = "default", className }: KpiCardProps) {
  return (
    <div className={cn("rounded-control border border-border bg-background p-3", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 font-mono text-lg font-semibold", toneClasses[tone])}>{value}</div>
      {delta ? <div className="mt-0.5 text-xs font-medium text-accent">{delta}</div> : null}
    </div>
  );
}
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "success" | "destructive" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-success-subtle text-success",
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

const baseClasses =
  "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...rest }: BadgeProps) {
  return <span className={cn(baseClasses, variantClasses[variant], className)} {...rest} />;
}
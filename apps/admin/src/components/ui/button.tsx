import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-muted text-foreground border-border",
  ghost: "text-accent",
  destructive: "text-destructive border-destructive",
};

const baseClasses =
  "inline-flex items-center gap-1.5 rounded-control border border-transparent px-4 py-2 text-sm font-semibold";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", type = "button", className, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...rest}
    />
  );
}
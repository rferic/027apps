import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-border bg-muted text-foreground",
  ghost: "border-transparent text-accent",
  destructive: "border-destructive text-destructive",
};

const baseClasses =
  "inline-flex items-center gap-1.5 rounded-control border px-4 py-2 text-sm font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
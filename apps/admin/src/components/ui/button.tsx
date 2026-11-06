import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border-border bg-muted text-foreground hover:bg-muted/80",
  ghost: "border-transparent text-accent hover:underline",
  destructive: "border-destructive text-destructive hover:bg-destructive/10",
};

const baseClasses =
  "inline-flex items-center justify-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrandLogo } from "@/components/brand-logo";

export interface NavItem {
  label: string;
  /** Navigation href (defaults to "#" for items without a route yet). */
  href?: string;
  active?: boolean;
}

export interface LayoutShellProps {
  title: string;
  nav: NavItem[];
  /** Instance logo (public setting); empty uses the bundled mark. */
  logoUrl?: string | null;
  /** Topbar content (e.g. a search box). */
  actions?: ReactNode;
  children?: ReactNode;
}

export function LayoutShell({ title, nav, logoUrl, actions, children }: LayoutShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[200px_1fr]">
      <aside className="flex flex-col gap-0.5 border-b border-border bg-muted p-3 lg:border-b-0 lg:border-r">
        <div className="mb-4 px-2.5 py-1.5">
          <BrandLogo logoUrl={logoUrl} />
        </div>
        <nav aria-label="Principal" className="flex gap-0.5 overflow-x-auto lg:flex-col">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href ?? "#"}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px]",
                item.active
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="flex flex-col p-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h1 className="min-w-0 truncate text-base font-bold">{title}</h1>
          {actions}
        </div>
        <main className="flex flex-col gap-4 pt-4">{children}</main>
      </div>
    </div>
  );
}

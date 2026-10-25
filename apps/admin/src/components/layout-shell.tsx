import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface NavItem {
  label: string;
  /** href de navegación (por defecto "#" para ítems sin ruta aún). */
  href?: string;
  active?: boolean;
}

export interface LayoutShellProps {
  title: string;
  nav: NavItem[];
  /** Contenido del topbar (p. ej. buscador). */
  actions?: ReactNode;
  children?: ReactNode;
}

export function LayoutShell({ title, nav, actions, children }: LayoutShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-[200px_1fr] bg-background">
      <aside className="flex flex-col gap-0.5 border-r border-border bg-muted p-3">
        <div className="mb-4 px-2.5 py-1.5 text-base font-extrabold tracking-tight">
          027<span className="text-accent">Apps</span>
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href ?? "#"}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
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
          <h1 className="text-base font-bold">{title}</h1>
          {actions}
        </div>
        <main className="flex flex-col gap-4 pt-4">{children}</main>
      </div>
    </div>
  );
}
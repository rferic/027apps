"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { cn } from "@/lib/cn";

interface PanelNavProps {
  messages: TranslationMap;
}

/** `/` only matches itself; every other destination also owns its sub-routes. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Grouped panel navigation (UX review §3). Labels are translated here with
 * literal keys so `i18n:scan` sees every one of them.
 */
export function PanelNav({ messages }: PanelNavProps) {
  const pathname = usePathname();
  const groups = [
    {
      label: t("Home", messages),
      items: [{ label: t("Dashboard", messages), href: "/" }],
    },
    {
      label: t("People", messages),
      items: [
        { label: t("Members", messages), href: "/members" },
        { label: t("Categories", messages), href: "/categories" },
        { label: t("Invitations", messages), href: "/invitations" },
      ],
    },
    {
      label: t("Platform", messages),
      items: [
        { label: t("Modules", messages), href: "/modules" },
        { label: t("API keys", messages), href: "/keys" },
      ],
    },
    {
      label: t("System", messages),
      items: [
        { label: t("Settings", messages), href: "/settings" },
        { label: t("API docs", messages), href: "/docs/api" },
      ],
    },
  ];

  return (
    <nav aria-label={t("Main navigation", messages)} className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label}>
          <h2 className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h2>
          <ul className="mt-1 flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-md px-2.5 py-1.5 text-[13px] focus-visible:ring-2 focus-visible:ring-accent",
                      active
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

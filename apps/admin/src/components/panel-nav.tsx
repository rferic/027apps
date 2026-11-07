"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { cn } from "@/lib/cn";
import {
  BookIcon,
  BoxIcon,
  HomeIcon,
  KeyIcon,
  MailIcon,
  type PanelIconComponent,
  SlidersIcon,
  TagIcon,
  UsersIcon,
} from "./panel-icons";

interface PanelNavProps {
  messages: TranslationMap;
  /** Drawer rows are taller and groups get a separator. */
  variant?: "sidebar" | "drawer";
  /** Runs after a destination is activated (the mobile drawer closes itself). */
  onNavigate?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: PanelIconComponent;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** `/` only matches itself; every other destination also owns its sub-routes. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Grouped panel navigation (UX review §3). The group heading is a quiet, small
 * caption; the destinations are the only rows that look clickable, each with an
 * icon and a left bar when active. Labels are translated here with literal keys
 * so `i18n:scan` sees every one of them.
 */
export function PanelNav({ messages, variant = "sidebar", onNavigate }: PanelNavProps) {
  const pathname = usePathname();
  const drawer = variant === "drawer";
  const groups: NavGroup[] = [
    {
      label: t("Home", messages),
      items: [{ label: t("Dashboard", messages), href: "/", icon: HomeIcon }],
    },
    {
      label: t("People", messages),
      items: [
        { label: t("Members", messages), href: "/members", icon: UsersIcon },
        { label: t("Categories", messages), href: "/categories", icon: TagIcon },
        { label: t("Invitations", messages), href: "/invitations", icon: MailIcon },
      ],
    },
    {
      label: t("Platform", messages),
      items: [
        { label: t("Modules", messages), href: "/modules", icon: BoxIcon },
        { label: t("API keys", messages), href: "/keys", icon: KeyIcon },
      ],
    },
    {
      label: t("System", messages),
      items: [
        { label: t("Settings", messages), href: "/settings", icon: SlidersIcon },
        { label: t("API docs", messages), href: "/docs/api", icon: BookIcon },
      ],
    },
  ];

  return (
    <nav
      aria-label={t("Main navigation", messages)}
      className={cn("flex flex-col", drawer ? "gap-5" : "gap-4")}
    >
      {groups.map((group, index) => (
        <div
          key={group.label}
          className={cn(drawer && index > 0 && "border-t border-border pt-5")}
        >
          <h2 className="px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h2>
          <ul className={cn("mt-1 flex flex-col", drawer ? "gap-1" : "gap-0.5")}>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-control border-l-2 px-2.5 text-sm focus-visible:ring-2 focus-visible:ring-accent",
                      drawer ? "min-h-12" : "min-h-11",
                      active
                        ? "border-accent bg-primary/10 font-semibold text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
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

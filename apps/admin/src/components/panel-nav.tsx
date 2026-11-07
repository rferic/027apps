"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { cn } from "@/lib/cn";
import type { PanelRole } from "@/lib/panel-guard";
import {
  settingsSectionLabel,
  visibleSettingsSections,
  type SettingsSectionSlug,
} from "@/lib/settings-sections";
import {
  BellIcon,
  BookIcon,
  BoxIcon,
  ExternalLinkIcon,
  GaugeIcon,
  GlobeIcon,
  HomeIcon,
  KeyIcon,
  MailIcon,
  type PanelIconComponent,
  ShieldIcon,
  SlidersIcon,
  TagIcon,
  UsersIcon,
} from "./panel-icons";

interface PanelNavProps {
  role: PanelRole;
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
  /** Renders a real anchor that opens in a new tab and never owns `aria-current`. */
  external?: boolean;
  /** Extra pathname that also lights this item up (a redirecting index route). */
  activeOn?: string;
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

/** Every settings section is its own top-level destination, with its own glyph. */
const SETTINGS_ICONS: Record<SettingsSectionSlug, PanelIconComponent> = {
  instance: SlidersIcon,
  localization: GlobeIcon,
  security: ShieldIcon,
  notifications: BellIcon,
  "rate-limits": GaugeIcon,
};

function NavDestination({
  item,
  pathname,
  messages,
  drawer,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  messages: TranslationMap;
  drawer: boolean;
  onNavigate?: () => void;
}) {
  const active =
    !item.external && (isActive(pathname, item.href) || item.activeOn === pathname);
  const Icon = item.icon;
  const className = cn(
    "flex items-center gap-2.5 rounded-control border-l-2 px-2.5 text-sm focus-visible:ring-2 focus-visible:ring-accent",
    drawer ? "min-h-12" : "min-h-11",
    active
      ? "border-accent bg-primary/10 font-semibold text-foreground"
      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  );

  return (
    <li>
      {item.external ? (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${item.label} (${t("Opens in a new tab", messages)})`}
          onClick={onNavigate}
          className={className}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{item.label}</span>
        </a>
      ) : (
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={className}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      )}
    </li>
  );
}

/**
 * Grouped panel navigation (UX review §3). The group heading is a quiet, small
 * caption; the destinations are the only rows that look clickable, each with an
 * icon and a left bar when active. Every settings section is a top-level
 * destination in the `Settings` group, minus those the role cannot read. An
 * external destination (`target="_blank"`) never carries `aria-current`. Labels
 * are translated here with literal keys so `i18n:scan` sees every one of them.
 */
export function PanelNav({ role, messages, variant = "sidebar", onNavigate }: PanelNavProps) {
  const pathname = usePathname();
  const drawer = variant === "drawer";
  const settingsSections = visibleSettingsSections(role);

  const groups: NavGroup[] = [
    {
      label: t("Home", messages),
      items: [{ label: t("Dashboard", messages), href: "/", icon: HomeIcon }],
    },
    {
      label: t("Users", messages),
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
      label: t("Settings", messages),
      items: settingsSections.map((section, index) => ({
        label: settingsSectionLabel(section, messages),
        href: `/settings/${section.slug}`,
        icon: SETTINGS_ICONS[section.slug],
        // `/settings` redirects to the first visible section; light it up while
        // the redirect resolves.
        activeOn: index === 0 ? "/settings" : undefined,
      })),
    },
    {
      label: t("Documentation", messages),
      items: [
        { label: t("API", messages), href: "/docs/api", icon: BookIcon },
        {
          label: t("Firebase guide", messages),
          href: "/help/firebase",
          icon: ExternalLinkIcon,
          external: true,
        },
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
            {group.items.map((item) => (
              <NavDestination
                key={item.href}
                item={item}
                pathname={pathname}
                messages={messages}
                drawer={drawer}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

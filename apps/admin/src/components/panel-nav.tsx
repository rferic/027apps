"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { cn } from "@/lib/cn";
import { ModuleIcon } from "@/components/ui/module-icon";
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
  /** Active modules with pages, in name order (D27). */
  modules?: Array<{ key: string; name: string; color?: string }>;
}

interface NavItem {
  label: string;
  href: string;
  icon: PanelIconComponent;
  /** Renders a real anchor that opens in a new tab and never owns `aria-current`. */
  external?: boolean;
  /** Extra pathname that also lights this item up (a redirecting index route). */
  activeOn?: string;
  /** A module row paints its brand icon instead of a panel glyph. */
  moduleKey?: string;
  color?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Every destination owns its sub-routes, except the dashboard: `/panel` is the
 * parent of every other panel route, so it only lights up on its own URL.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/panel") return pathname === "/panel";
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

function NavGlyph({ item, Icon }: { item: NavItem; Icon: PanelIconComponent }) {
  if (item.moduleKey) {
    return <ModuleIcon moduleKey={item.moduleKey} size={20} color={item.color} />;
  }
  return <Icon className="h-5 w-5 shrink-0" />;
}

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
          <NavGlyph item={item} Icon={Icon} />
          <span className="truncate">{item.label}</span>
        </a>
      ) : (
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
          className={className}
        >
          <NavGlyph item={item} Icon={Icon} />
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
export function PanelNav({
  role,
  messages,
  variant = "sidebar",
  onNavigate,
  modules = [],
}: PanelNavProps) {
  const pathname = usePathname();
  const drawer = variant === "drawer";
  const settingsSections = visibleSettingsSections(role);

  const groups: NavGroup[] = [
    {
      label: t("Home", messages),
      items: [{ label: t("Dashboard", messages), href: "/panel", icon: HomeIcon }],
    },
    ...(modules.length > 0
      ? [
          {
            label: t("Modules", messages),
            items: modules.map((module) => ({
              label: module.name,
              href: `/panel/${encodeURIComponent(module.key)}`,
              icon: BoxIcon,
              moduleKey: module.key,
              color: module.color,
            })),
          },
        ]
      : []),
    {
      label: t("Users", messages),
      items: [
        { label: t("Members", messages), href: "/panel/members", icon: UsersIcon },
        { label: t("Categories", messages), href: "/panel/categories", icon: TagIcon },
        { label: t("Invitations", messages), href: "/panel/invitations", icon: MailIcon },
      ],
    },
    {
      label: t("Platform", messages),
      items: [
        { label: t("Modules", messages), href: "/panel/modules", icon: BoxIcon },
        ...(role === "super_admin"
          ? [{ label: t("API keys", messages), href: "/panel/keys", icon: KeyIcon }]
          : []),
      ],
    },
    {
      label: t("Settings", messages),
      items: settingsSections.map((section, index) => ({
        label: settingsSectionLabel(section, messages),
        href: `/panel/settings/${section.slug}`,
        icon: SETTINGS_ICONS[section.slug],
        // `/settings` redirects to the first visible section; light it up while
        // the redirect resolves.
        activeOn: index === 0 ? "/panel/settings" : undefined,
      })),
    },
    {
      label: t("Documentation", messages),
      items: [
        { label: t("API", messages), href: "/panel/docs/api", icon: BookIcon },
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

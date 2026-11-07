import type { ComponentType, ReactNode, SVGProps } from "react";

/**
 * Inline panel icons (no icon dependency). Every glyph shares the same geometry
 * and inherits `currentColor`; size comes from the caller's classes, so the same
 * icon works at 20 px in the sidebar and inside the mobile trigger.
 */
type IconProps = Omit<
  SVGProps<SVGSVGElement>,
  "viewBox" | "fill" | "stroke" | "strokeWidth" | "strokeLinecap" | "strokeLinejoin"
>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export type PanelIconComponent = ComponentType<IconProps>;

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 8.5V20h14V8.5" />
      <path d="M9.5 20v-5h5v5" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 20v-1.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4V20" />
      <path d="M16.5 4.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M21 20v-1.5a4 4 0 0 0-3-3.87" />
    </Icon>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 3h7.2a2 2 0 0 1 1.4.6l8.8 8.8a2 2 0 0 1 0 2.8l-4.2 4.2a2 2 0 0 1-2.8 0L4.6 10.6A2 2 0 0 1 4 9.2V4a1 1 0 0 1 1-1z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </Icon>
  );
}

export function BoxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 9 5v8l-9 5-9-5V8z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </Icon>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 8.6-8.6" />
      <path d="m17 6 2.5 2.5" />
      <path d="m14.5 8.5 2.5 2.5" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 21v-6" />
      <path d="M4 11V3" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M20 21v-4" />
      <path d="M20 13V3" />
      <path d="M1.5 15h5" />
      <path d="M9.5 8h5" />
      <path d="M17.5 17h5" />
    </Icon>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </Icon>
  );
}

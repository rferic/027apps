"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Whether the next interaction should close the user menu. Pure so the intent
 * can be tested without a DOM: Escape always closes an open menu, a pointer
 * event closes it only when it starts outside the menu box, and a closed menu
 * ignores both.
 */
export function closesUserMenu(input: {
  open: boolean;
  event: "pointerdown" | "escape";
  inside: boolean;
}): boolean {
  if (!input.open) return false;
  if (input.event === "escape") return true;
  return !input.inside;
}

function closeMenu(node: HTMLDetailsElement | null) {
  if (node) node.open = false;
}

/**
 * The session menu. A native `<details>` keeps it usable without JavaScript;
 * this wrapper only adds the affordances the native element lacks: closing on
 * an outside click, on Escape, and when the route changes.
 */
export function UserMenu({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    closeMenu(detailsRef.current);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const node = detailsRef.current;
      if (!node) return;
      const inside = event.target instanceof Node && node.contains(event.target);
      if (closesUserMenu({ open: node.open, event: "pointerdown", inside })) {
        closeMenu(node);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const node = detailsRef.current;
      if (!node || event.key !== "Escape") return;
      if (closesUserMenu({ open: node.open, event: "escape", inside: false })) {
        closeMenu(node);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative min-w-0">
      {summary}
      {children}
    </details>
  );
}

export function isPublicHelpPath(pathname: string): boolean {
  return pathname === "/help" || pathname.startsWith("/help/");
}

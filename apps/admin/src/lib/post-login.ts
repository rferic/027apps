/**
 * Where to send a user right after signing in. An instance with pending setup
 * steps (an admin exists but `instance.public_url` / `localization.*` are
 * missing) goes back to the wizard instead of the panel, so the installation
 * can be finished without hunting for the banner.
 */
export function postLoginPath(setupIncomplete: boolean): string {
  return setupIncomplete ? "/setup" : "/panel";
}

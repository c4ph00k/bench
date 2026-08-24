/**
 * The session, from the five documents' side. The api helpers in each app send a 401 here on
 * their own; this module is the navigation the strip's sign-out button and the login document
 * need.
 */

/** Leaving, in one place so the unit tests can intercept it - jsdom cannot navigate. */
export function redirectTo(path: string): void {
  window.location.replace(path);
}

/** Ends the session server-side, then leaves - the gate takes it from there. */
export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  redirectTo("/login");
}

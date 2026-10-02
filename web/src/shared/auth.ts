/**
 * The session, from the five documents' side. The api helpers in each app send a 401 here on
 * their own; this module is the navigation the strip's sign-out button and the login document
 * need, plus the role and must-change information the chrome and the new pages read from /me.
 */
import { useEffect, useState } from "react";

export type Role = "owner" | "admin" | "user";

export interface SessionInfo {
  email: string;
  role?: Role;
  mustChangePassword: boolean;
  masterAdmin: boolean;
}

/** Leaving, in one place so the unit tests can intercept it - jsdom cannot navigate. */
export function redirectTo(path: string): void {
  window.location.replace(path);
}

/** Ends the session server-side, then leaves - the gate takes it from there. */
export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
  redirectTo("/login");
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
}

const TENANT_KEY = "bench.tenantId";

/** The tenant the user has switched into, or null when they run on their default membership. */
export function selectedTenantId(): string | null {
  return localStorage.getItem(TENANT_KEY);
}

export function selectTenant(id: number | null): void {
  if (id === null) localStorage.removeItem(TENANT_KEY);
  else localStorage.setItem(TENANT_KEY, String(id));
}

/** The X-Tenant-Id header naming the selected tenant, empty when defaulting. The server still
    validates it against the session's memberships, so this is a preference, not an authority. */
export function tenantHeader(): Record<string, string> {
  const id = selectedTenantId();
  return id ? { "X-Tenant-Id": id } : {};
}

export async function getTenants(): Promise<Tenant[]> {
  const res = await fetch("/api/auth/tenants");
  if (!res.ok) return [];
  return (await res.json()) as Tenant[];
}

/** The signed-in user, or null - the same call the launcher and login document already make. */
export async function getSession(): Promise<SessionInfo | null> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  return (await res.json()) as SessionInfo;
}

/** Learns the session once, for chrome only admins see - one /me call per document. Undefined
    until the call settles, so callers can tell "not yet known" from "nobody signed in". */
export function useSession(): SessionInfo | null | undefined {
  const [session, setSession] = useState<SessionInfo | null | undefined>(
    undefined,
  );
  useEffect(() => {
    void getSession().then(setSession);
  }, []);
  return session;
}

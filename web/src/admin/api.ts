/** Fetch helpers for the users endpoint, the admin panel's only API surface. */
import { redirectTo, type Role } from "../shared/auth";

/** A user as the admin panel sees them - the shape /api/auth/users returns. */
export interface PublicUser {
  id: number;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/auth/users${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    redirectTo("/login");
    throw new Error("Not signed in");
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(detail.error ?? `${method} failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const adminApi = {
  list: () => req<PublicUser[]>("GET", ""),
  create: (email: string, password: string, role: Role) =>
    req<PublicUser>("POST", "", { email, password, role }),
  update: (id: number, patch: { role?: Role; email?: string }) =>
    req<PublicUser>("PATCH", `/${id}`, patch),
  remove: (id: number) => req<undefined>("DELETE", `/${id}`),
  resetPassword: (id: number, password: string) =>
    req<undefined>("POST", `/${id}/reset-password`, { password }),
};

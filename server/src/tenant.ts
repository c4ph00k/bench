import type { Request, Response } from "express";
import type { Pool } from "pg";
import * as auth from "./auth/db.js";

/** The tenant the current request acts on, set by the gate in app.ts for every authentic session. */
export function tenantIdOf(res: Response): number {
  return res.locals.tenantId as number;
}

/**
 * The tenant a request names: the `X-Tenant-Id` header when the user may act in it, else their
 * first membership. A master admin may assume any existing tenant (the switcher's backend half);
 * everyone else must be a member of the one they name.
 */
export async function resolveTenant(
  pool: Pool,
  user: auth.UserRow,
  req: Request,
): Promise<number | null> {
  const header = req.headers["x-tenant-id"];
  if (typeof header === "string" && header !== "") {
    const tenantId = Number(header);
    if (Number.isNaN(tenantId)) return null;
    if (user.master_admin) {
      return (await auth.tenantExists(pool, tenantId)) ? tenantId : null;
    }
    const role = await auth.membershipRole(pool, tenantId, user.id);
    return role === undefined ? null : tenantId;
  }
  return auth.primaryTenantId(pool, user.id);
}

import type { Response } from "express";
import type { Pool, PoolClient } from "pg";

/** The RLS-bound role the per-request connection drops to, fixed in migrations/0005_rls.sql. */
const RLS_ROLE = "app_rls";

/**
 * Open the per-request connection that scopes every operational query. The connection drops to the
 * RLS-bound role and names the tenant, so even a query that forgets its tenant_id still sees only
 * this tenant's rows. Commits on a normal response, rolls back on a 5xx or an aborted connection.
 */
export async function openTenantConnection(
  pool: Pool,
  res: Response,
  tenantId: number,
): Promise<void> {
  const client = await pool.connect();
  await client.query("BEGIN");
  await client.query(`SET LOCAL ROLE ${RLS_ROLE}`);
  // SET accepts no bind parameters, and tenantId is a number already, so inlining is safe.
  await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
  res.locals.db = client;
  res.once("finish", () => endTenantConnection(res, res.statusCode < 500));
  res.once("close", () => endTenantConnection(res, false));
}

function endTenantConnection(res: Response, commit: boolean): void {
  const client = res.locals.db as PoolClient | undefined;
  if (!client) return;
  res.locals.db = undefined;
  void client
    .query(commit ? "COMMIT" : "ROLLBACK")
    .catch(() => undefined)
    .finally(() => client.release());
}

/** The request's scoped connection, handed to the routers mounted below the gate. */
export function requestDb(res: Response): Pool | PoolClient {
  return res.locals.db as Pool | PoolClient;
}

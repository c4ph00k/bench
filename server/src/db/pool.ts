import { Pool, types } from "pg";
import type { PoolClient, PoolConfig } from "pg";

/** A pooled connection or a request-scoped client; both answer `.query` the same way. */
export type Db = Pool | PoolClient;

let configured = false;

/**
 * A Pool whose `bigint` columns come back as JS numbers instead of strings, so an id read from
 * `users` is the number it was inserted as. Set once, since the parser is a process-wide mapping.
 */
export function createPool(config?: PoolConfig): Pool {
  if (!configured) {
    types.setTypeParser(20, (value) => Number(value));
    configured = true;
  }
  return new Pool(config);
}

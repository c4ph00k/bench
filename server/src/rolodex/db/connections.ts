/** How two people are connected, and how that reads from either end. */
import { nowISO } from "../dates.js";
import type { Connection, ConnectionKind, ConnectionView } from "../types.js";
import { connectionFromRow, type Row } from "./rows.js";
import type { Queryable } from "./index.js";

export interface ConnectionInput {
  kind: ConnectionKind;
  a_is_parent: boolean;
  label: string | null;
  inverse_label: string | null;
  note: string | null;
}

export interface ConnectionsRepo {
  listConnections(personId: number): Promise<ConnectionView[]>;
  createConnection(
    a: number,
    b: number,
    input: ConnectionInput,
  ): Promise<Connection>;
  deleteConnection(id: number): Promise<boolean>;
}

/** The same row reads differently from each end: A is B's parent, so B is A's child. */
function describeConnection(
  personId: number,
  c: Connection,
  otherName: string,
): string {
  switch (c.kind) {
    case "partner":
      return `Partner of ${otherName}`;
    case "sibling":
      return `Sibling of ${otherName}`;
    case "colleague":
      return c.note
        ? `Colleague of ${otherName} — ${c.note}`
        : `Colleague of ${otherName}`;
    case "parent_child": {
      const isParent = c.a_is_parent === (personId === c.person_a);
      return isParent ? `Parent of ${otherName}` : `Child of ${otherName}`;
    }
    case "other":
      return personId === c.person_a
        ? c.label || `Connected to ${otherName}`
        : c.inverse_label || `Connected to ${otherName}`;
  }
}

export function connectionsRepo(
  db: Queryable,
  tenantId: number,
): ConnectionsRepo {
  return {
    listConnections: async (personId) => {
      const result = await db.query<Row>(
        `SELECT c.*, pa.name AS a_name, pb.name AS b_name FROM connections c
         JOIN people pa ON pa.id = c.person_a
         JOIN people pb ON pb.id = c.person_b
         WHERE c.tenant_id = $1 AND (c.person_a = $2 OR c.person_b = $2)`,
        [tenantId, personId],
      );
      return result.rows.map((r) => {
        const c = connectionFromRow(r);
        const isA = c.person_a === personId;
        const otherName = (isA ? r.b_name : r.a_name) as string;
        return {
          id: c.id,
          other_id: isA ? c.person_b : c.person_a,
          other_name: otherName,
          kind: c.kind,
          description: describeConnection(personId, c, otherName),
          note: c.note,
        };
      });
    },

    createConnection: async (a, b, input) => {
      const result = await db.query<Row>(
        `INSERT INTO connections (tenant_id, person_a, person_b, kind, a_is_parent, label, inverse_label, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          tenantId,
          a,
          b,
          input.kind,
          input.a_is_parent,
          input.label,
          input.inverse_label,
          input.note,
          nowISO(),
        ],
      );
      return connectionFromRow(result.rows[0]);
    },

    deleteConnection: async (id) => {
      const result = await db.query(
        "DELETE FROM connections WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}

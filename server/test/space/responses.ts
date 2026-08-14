/**
 * The shapes the Space API hands back. supertest types a response body as `any`, and that spreads
 * out through every assertion in these suites, so the tests name what they expect instead.
 */

export interface Option {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Property {
  id: string;
  name: string;
  type: string;
  position: number;
  options: Option[];
}

export interface Row {
  id: string;
  title: string;
  icon: string | null;
  position: number;
  values: Record<string, unknown>;
}

export interface View {
  filters: unknown[];
  sort: { propertyId: string; direction: string } | null;
  groupBy: string | null;
}

export interface DatabaseView {
  id: string;
  title: string;
  icon: string | null;
  properties: Property[];
  rows: Row[];
  views: Record<string, View>;
}

export interface Block {
  id: string;
  page_id: string;
  type: string;
  content: { text?: string; checked?: boolean };
  position: number;
}

export interface Page {
  id: string;
  parent_id: string | null;
  type: string;
  title: string;
  icon: string | null;
  position: number;
  blocks: Block[];
}

export interface TreeNode {
  id: string;
  parent_id: string | null;
  type: string;
  title: string;
  icon: string | null;
  position: number;
  children: TreeNode[];
}

export interface RowPage {
  id: string;
  database_id: string;
  database_title: string;
  title: string;
  properties: Property[];
  values: Record<string, unknown>;
}

export interface SearchHit {
  id: string;
  title: string;
  type: string;
  parent_title: string | null;
}

export interface Ok {
  ok: boolean;
}

/** `SELECT COUNT(*) AS c`, which several suites check directly against the database. */
export interface Count {
  c: number;
}

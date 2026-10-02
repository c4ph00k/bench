/** Row shapes for the tables in migrations/0003_space.sql. The JSON-bearing columns - a block's
    `content`, a row value's `value`, a view's `config` - are stored and returned as text, and
    parsed at the edges. */
export interface BlockRow {
  id: string;
  page_id: string;
  type: string;
  content: string;
  position: number;
}

export interface PropertyRow {
  id: string;
  database_id: string;
  name: string;
  type: string;
  position: number;
}

export interface PropertyOptionRow {
  id: string;
  property_id: string;
  name: string;
  color: string;
  position: number;
}

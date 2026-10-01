CREATE TABLE pages (
  id text PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id text REFERENCES pages(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'page' CHECK (type IN ('page', 'database', 'row')),
  title text NOT NULL DEFAULT '',
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT now()::text,
  updated_at text NOT NULL DEFAULT now()::text
);
CREATE INDEX idx_pages_parent ON pages(parent_id);
CREATE INDEX idx_pages_tenant ON pages(tenant_id);

CREATE TABLE blocks (
  id text PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL DEFAULT '{}',
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_blocks_page ON blocks(page_id);
CREATE INDEX idx_blocks_tenant ON blocks(tenant_id);

CREATE TABLE properties (
  id text PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  database_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (
    type IN ('text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url')
  ),
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_properties_db ON properties(database_id);

CREATE TABLE property_options (
  id text PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id text NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_options_property ON property_options(property_id);

CREATE TABLE row_values (
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  row_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_id text NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  value text,
  PRIMARY KEY (row_id, property_id)
);

CREATE TABLE views (
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  database_id text NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('table', 'board', 'list')),
  config text NOT NULL DEFAULT '{}',
  PRIMARY KEY (database_id, kind)
);
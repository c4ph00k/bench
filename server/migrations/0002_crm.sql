CREATE TABLE organizations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  industry text,
  notes text,
  created_at text NOT NULL DEFAULT now()::text
);

CREATE TABLE contacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  job_title text,
  organization_id bigint REFERENCES organizations(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('lead', 'qualified', 'customer')),
  created_at text NOT NULL DEFAULT now()::text
);

CREATE TABLE deals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  organization_id bigint REFERENCES organizations(id) ON DELETE SET NULL,
  contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
  stage text NOT NULL CHECK (
    stage IN ('New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')
  ),
  value double precision NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 0,
  close_date text,
  board_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT now()::text
);

CREATE TABLE activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('note', 'call', 'email')),
  contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id bigint REFERENCES deals(id) ON DELETE SET NULL,
  description text NOT NULL,
  occurred_at text NOT NULL DEFAULT now()::text,
  due_date text,
  done boolean NOT NULL DEFAULT false,
  created_at text NOT NULL DEFAULT now()::text
);
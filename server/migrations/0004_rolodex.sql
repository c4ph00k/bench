CREATE TABLE people (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  job_title text,
  company text,
  city text,
  timezone text,
  circle text NOT NULL DEFAULT 'close',
  cadence_override_days integer,
  checkins_off boolean NOT NULL DEFAULT false,
  snoozed_until text,
  how_met text,
  met_where text,
  met_on text,
  notes text,
  tags text NOT NULL DEFAULT '[]',
  photo text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX idx_people_tenant ON people(tenant_id);

CREATE TABLE interactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type text NOT NULL,
  date text NOT NULL,
  notes text,
  created_at text NOT NULL
);
CREATE INDEX idx_interactions_person ON interactions(person_id, date);

CREATE TABLE important_dates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text,
  month integer NOT NULL,
  day integer NOT NULL,
  year integer,
  created_at text NOT NULL
);

CREATE TABLE facts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE news (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  text text NOT NULL,
  date text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX idx_news_person ON news(person_id, date);

CREATE TABLE reminders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  text text NOT NULL,
  due_date text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  done_at text,
  created_at text NOT NULL
);
CREATE INDEX idx_reminders_person ON reminders(person_id);

CREATE TABLE gifts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL,
  occasion text,
  date text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE connections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id bigint NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_a bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  kind text NOT NULL,
  a_is_parent boolean NOT NULL DEFAULT false,
  label text,
  inverse_label text,
  note text,
  created_at text NOT NULL
);
CREATE INDEX idx_connections_a ON connections(person_a);
CREATE INDEX idx_connections_b ON connections(person_b);
CREATE ROLE app_rls;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rls;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations', 'contacts', 'deals', 'activities',
    'pages', 'blocks', 'properties', 'property_options', 'row_values', 'views',
    'people', 'interactions', 'important_dates', 'facts', 'news', 'reminders',
    'gifts', 'connections'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL USING (tenant_id = current_setting(''app.tenant_id'', true)::bigint) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::bigint)',
      t
    );
  END LOOP;
END $$;
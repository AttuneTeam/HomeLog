-- ============================================================
-- Extend the storage-object functions to cover rental_payments.statement_path,
-- the file-bearing column added in migration 063.
--
-- Storage has no DB cascade, so every column holding a storage path must be
-- enumerated in BOTH functions or deletion silently leaks the files. See the
-- maintenance rule in docs/account-deletion.md.
--
-- Statements go into the `property-files` bucket and are scoped by property, so
-- ownership is resolved through properties.user_id — never by the uploader path
-- prefix. A statement can legitimately be uploaded by an active co-owner guest,
-- in which case the storage object sits under the GUEST's id while the
-- rental_payments row belongs to the OWNER's property. Reintroducing a prefix
-- scan here would recreate exactly the cross-owner data-loss bug these
-- functions exist to prevent.
--
-- No SELECT DISTINCT on this branch, unlike depreciation_reports. One statement
-- maps to one payment row, so a path cannot repeat. If that ever changes — a
-- statement spanning several payment rows — this branch needs DISTINCT too.
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_storage_objects(p_user_id uuid)
RETURNS TABLE (bucket text, path text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- expense invoices (owner-scoped via renovation -> property)
  SELECT 'invoices'::text, e.invoice_path
  FROM expenses e
  JOIN renovations r ON r.id = e.renovation_id
  JOIN properties p ON p.id = r.property_id
  WHERE p.user_id = p_user_id AND e.invoice_path IS NOT NULL

  UNION ALL
  -- renovation quote files (owner-scoped via renovation -> property)
  SELECT 'renovation-quotes', rq.file_path
  FROM renovation_quotes rq
  JOIN renovations r ON r.id = rq.renovation_id
  JOIN properties p ON p.id = r.property_id
  WHERE p.user_id = p_user_id AND rq.file_path IS NOT NULL

  UNION ALL
  -- property files (owner-scoped via property)
  SELECT 'property-files', pf.storage_path
  FROM property_files pf
  JOIN properties p ON p.id = pf.property_id
  WHERE p.user_id = p_user_id AND pf.storage_path IS NOT NULL

  UNION ALL
  -- rental operating expense invoices (owner-scoped via property)
  SELECT 'invoices', roe.invoice_path
  FROM rental_operating_expenses roe
  JOIN properties p ON p.id = roe.property_id
  WHERE p.user_id = p_user_id AND roe.invoice_path IS NOT NULL

  UNION ALL
  -- staged receipts (directly user-owned)
  SELECT 'invoices', sr.storage_path
  FROM staged_receipts sr
  WHERE sr.user_id = p_user_id AND sr.storage_path IS NOT NULL

  UNION ALL
  -- annual loan statements (owner-scoped via property)
  SELECT 'property-files', ls.storage_path
  FROM loan_statements ls
  JOIN properties p ON p.id = ls.property_id
  WHERE p.user_id = p_user_id AND ls.storage_path IS NOT NULL

  UNION ALL
  -- quantity surveyor reports (owner-scoped via property; deduplicated
  -- because one report is normally cited by several financial years)
  SELECT DISTINCT 'property-files', dr.storage_path
  FROM depreciation_reports dr
  JOIN properties p ON p.id = dr.property_id
  WHERE p.user_id = p_user_id AND dr.storage_path IS NOT NULL

  UNION ALL
  -- managing agent rental statements (owner-scoped via property)
  SELECT 'property-files', rp.statement_path
  FROM rental_payments rp
  JOIN properties p ON p.id = rp.property_id
  WHERE p.user_id = p_user_id AND rp.statement_path IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.property_storage_objects(p_property_id uuid)
RETURNS TABLE (bucket text, path text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- expense invoices (via renovation -> property)
  SELECT 'invoices'::text, e.invoice_path
  FROM expenses e
  JOIN renovations r ON r.id = e.renovation_id
  WHERE r.property_id = p_property_id AND e.invoice_path IS NOT NULL

  UNION ALL
  -- renovation quote files (via renovation -> property)
  SELECT 'renovation-quotes', rq.file_path
  FROM renovation_quotes rq
  JOIN renovations r ON r.id = rq.renovation_id
  WHERE r.property_id = p_property_id AND rq.file_path IS NOT NULL

  UNION ALL
  -- property files
  SELECT 'property-files', pf.storage_path
  FROM property_files pf
  WHERE pf.property_id = p_property_id AND pf.storage_path IS NOT NULL

  UNION ALL
  -- rental operating expense invoices
  SELECT 'invoices', roe.invoice_path
  FROM rental_operating_expenses roe
  WHERE roe.property_id = p_property_id AND roe.invoice_path IS NOT NULL

  UNION ALL
  -- annual loan statements
  SELECT 'property-files', ls.storage_path
  FROM loan_statements ls
  WHERE ls.property_id = p_property_id AND ls.storage_path IS NOT NULL

  UNION ALL
  -- quantity surveyor reports (deduplicated: one report normally covers
  -- several financial years)
  SELECT DISTINCT 'property-files', dr.storage_path
  FROM depreciation_reports dr
  WHERE dr.property_id = p_property_id AND dr.storage_path IS NOT NULL

  UNION ALL
  -- managing agent rental statements
  SELECT 'property-files', rp.statement_path
  FROM rental_payments rp
  WHERE rp.property_id = p_property_id AND rp.statement_path IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.user_storage_objects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_storage_objects(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_storage_objects(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.user_storage_objects(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.property_storage_objects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.property_storage_objects(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.property_storage_objects(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.property_storage_objects(uuid) TO service_role;

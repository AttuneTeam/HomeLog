-- Returns every storage object OWNED by a user, scoped by data ownership rather than
-- by the uploader-id path prefix. This is used by account deletion to remove the user's
-- own files WITHOUT touching files they (as a co-owner guest) uploaded into another
-- owner's property — those rows survive the cascade and must keep their storage objects.
--
-- service_role only. SECURITY DEFINER so it can read across all owners' rows.
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
  WHERE sr.user_id = p_user_id AND sr.storage_path IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.user_storage_objects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_storage_objects(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_storage_objects(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.user_storage_objects(uuid) TO service_role;

-- Returns every storage object belonging to a single property, across all buckets.
-- Used when a property is deleted so its files can be removed from storage (DB rows
-- cascade, but storage has no cascade). Scoped by property, so it correctly includes
-- files a co-owner guest uploaded into the property (those rows reference this property).
--
-- service_role only. SECURITY DEFINER so it can read regardless of caller RLS.
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
  WHERE roe.property_id = p_property_id AND roe.invoice_path IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.property_storage_objects(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.property_storage_objects(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.property_storage_objects(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.property_storage_objects(uuid) TO service_role;

"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Delete a property and all of its data, including storage objects.
 *
 * DB rows cascade off `properties` automatically, but storage has no cascade — and the
 * files may sit under a co-owner guest's id prefix, which the owner's RLS-scoped client
 * cannot remove. So we collect the property's storage objects (by property, via a
 * SECURITY DEFINER function), delete the property under RLS (owner-only), then remove the
 * files with the admin client.
 */
export async function deleteProperty(
  propertyId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Collect the property's storage objects BEFORE deletion (the cascade removes the rows).
  const admin = createAdminClient();
  const { data: objects } = await admin.rpc("property_storage_objects", {
    p_property_id: propertyId,
  });

  // Delete the property via the RLS-scoped client — the "delete: owner only" policy ensures
  // a guest/co-owner cannot delete someone else's property.
  const { error } = await supabase.from("properties").delete().eq("id", propertyId);
  if (error) return { error: error.message };

  // Remove storage objects (admin bypasses the uploader-prefix storage RLS).
  if (objects && objects.length > 0) {
    const byBucket = new Map<string, string[]>();
    for (const { bucket, path } of objects) {
      if (!path) continue;
      const list = byBucket.get(bucket) ?? [];
      list.push(path);
      byBucket.set(bucket, list);
    }
    for (const [bucket, paths] of byBucket) {
      if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
    }
  }

  return { error: null };
}

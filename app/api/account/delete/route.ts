import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Delete only storage objects the user OWNS (scoped by data ownership, not the uploader-id
// path prefix). This deliberately preserves files the user uploaded — as a co-owner guest —
// into another owner's property: those DB rows survive the cascade and must keep their files.
async function deleteOwnedStorage(admin: SupabaseClient<Database>, userId: string) {
  const { data: objects } = await admin.rpc("user_storage_objects", { p_user_id: userId });
  if (!objects || objects.length === 0) return;

  // Group paths by bucket and remove in batches
  const byBucket = new Map<string, string[]>();
  for (const { bucket, path } of objects) {
    if (!path) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push(path);
    byBucket.set(bucket, list);
  }

  for (const [bucket, paths] of byBucket) {
    if (paths.length > 0) {
      await admin.storage.from(bucket).remove(paths);
    }
  }
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Note: a guest (someone with shared access to another owner's account) is allowed to delete
  // their own account. The cascade below only removes rows this user *owns* — the owner's shared
  // properties/expenses key off the owner's user_id and are never touched. We only strip the
  // membership rows that point at this user (step 2) so the owner's Sharing panel stays clean.
  const admin = createAdminClient();

  // 1. Delete storage objects the user owns. Must run BEFORE the auth-user delete,
  //    since the lookup reads DB rows that the cascade will remove.
  await deleteOwnedStorage(admin, user.id);

  // 2. Delete non-cascading rows that would otherwise become orphaned nulls
  //    - user_contractors: no cascade defined
  //    - account_members/property_shares where this user is a *grantee*: FK is SET NULL,
  //      so the owner would see a ghost entry in their Sharing UI after deletion
  await Promise.all([
    admin.from("user_contractors").delete().eq("user_id", user.id),
    admin.from("account_members").delete().eq("grantee_user_id", user.id),
    admin.from("property_shares").delete().eq("grantee_user_id", user.id),
  ]);

  // 3. Delete the auth user via a SECURITY DEFINER RPC — cascades profiles → properties → all
  //    dependent rows. We use rpc() instead of auth.admin.deleteUser() because the GoTrue admin
  //    endpoint rejects the service-role key on local Supabase (ES256 signing mismatch).
  const { error } = await admin.rpc("delete_auth_user", { user_id: user.id });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

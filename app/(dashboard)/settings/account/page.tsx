import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";
import { AccountSettingsClient } from "@/components/account-settings-client";
import { SharingSettingsClient } from "@/components/sharing-settings-client";
import { DeleteAccountClient } from "@/components/delete-account-client";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: myMembers }, { data: rawSharedWithMe }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase
      .from("account_members")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("account_members")
      .select("id, owner_id, status")
      .eq("grantee_user_id", user.id)
      .neq("status", "revoked")
      .order("created_at", { ascending: false }),
  ]);

  const ownerIds = [...new Set((rawSharedWithMe ?? []).map((m) => m.owner_id))];
  const { data: ownerProfiles } = ownerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ownerIds)
    : { data: [] };
  const profileMap = Object.fromEntries(
    (ownerProfiles ?? []).map((p) => [p.id, p.display_name]),
  );
  const sharedWithMe = (rawSharedWithMe ?? []).map((m) => ({
    ...m,
    profiles: { display_name: profileMap[m.owner_id] ?? null },
  }));

  // Guests (invited co-owners) cannot send invites
  const isGuest = sharedWithMe.some((m) => m.status === "active");

  return (
    <div className="p-6 max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-caslon font-bold">Account</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Manage your name, account details, and sharing settings
        </p>
      </div>

      <AccountSettingsClient
        email={user.email ?? ""}
        displayName={profile?.display_name ?? ""}
      />

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-1">Sharing & Access</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Manage who has access to your account and properties
        </p>
        <SharingSettingsClient
          myMembers={myMembers ?? []}
          sharedWithMe={sharedWithMe}
          currentUserEmail={user.email ?? ""}
          isGuest={isGuest}
        />
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-1 text-destructive">Danger Zone</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Irreversible actions that permanently affect your account and data.
        </p>
        <DeleteAccountClient isGuest={isGuest} />
      </div>
    </div>
  );
}

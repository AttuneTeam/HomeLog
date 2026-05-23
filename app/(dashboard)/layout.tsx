import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const displayNameFromMeta =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : null;

  await supabase
    .from("profiles")
    .upsert(
      { id: user.id, display_name: displayNameFromMeta },
      { onConflict: "id", ignoreDuplicates: true },
    );

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <DashboardShell displayName={profile?.display_name ?? user.email ?? "User"}>
      {children}
    </DashboardShell>
  );
}

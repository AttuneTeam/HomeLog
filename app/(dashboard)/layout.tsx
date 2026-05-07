import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

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
    <div className="flex min-h-screen">
      <Sidebar displayName={profile?.display_name ?? user.email ?? "User"} />
      <main className="bg-gray-100 flex-1 overflow-auto">{children}</main>
    </div>
  );
}

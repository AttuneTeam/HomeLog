import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { XeroConnectPanel } from "@/components/xero-connect-panel";
import { XeroAccountMappingPanel } from "@/components/xero-account-mapping-panel";

export default async function XeroSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { connected, error } = await searchParams;

  const [{ data: connections }, { data: existingMappings }] = await Promise.all([
    supabase
      .from("xero_connections")
      .select("tenant_id, tenant_name, connected_at")
      .eq("user_id", user.id)
      .order("connected_at", { ascending: false }),
    supabase
      .from("xero_account_mappings")
      .select("*")
      .eq("user_id", user.id),
  ]);

  const activeConnections = connections ?? [];
  const primaryTenantId = activeConnections[0]?.tenant_id ?? null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Connect external services to sync your financial data
        </p>
      </div>

      <XeroConnectPanel
        connections={activeConnections}
        justConnected={connected === "1"}
        connectError={error ?? null}
      />

      {primaryTenantId && (
        <XeroAccountMappingPanel
          tenantId={primaryTenantId}
          existingMappings={existingMappings ?? []}
        />
      )}
    </div>
  );
}

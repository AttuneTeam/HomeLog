import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailSyncPanel } from "@/components/email-sync-panel";

export default async function EmailSyncSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: log } = await (supabase as any)
    .from("email_ingestion_log")
    .select("id, received_at, sender_address, raw_subject, status, extracted_type, parse_notes")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(20);

  const inboundDomain = process.env.INBOUND_EMAIL_DOMAIN ?? "mail.homebase.app";
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-caslon font-bold">Email sync</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Automatically import rental payments and expenses from agent emails
        </p>
      </div>

      <EmailSyncPanel
        userId={user.id}
        inboundDomain={inboundDomain}
        recentLog={log ?? []}
        isDev={isDev}
      />
    </div>
  );
}

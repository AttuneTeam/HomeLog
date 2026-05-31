"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface XeroConnection {
  tenant_id: string;
  tenant_name: string | null;
  connected_at: string;
}

interface Props {
  connections: XeroConnection[];
  justConnected: boolean;
  connectError: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  pkce_missing: "Session expired. Please try connecting again.",
  pkce_invalid: "Invalid session. Please try connecting again.",
  state_mismatch: "Security check failed. Please try connecting again.",
  token_exchange_failed: "Could not retrieve tokens from Xero. Please try again.",
  tenant_fetch_failed: "Could not load your Xero organisation. Please try again.",
  no_tenants: "No Xero organisations found. Make sure you have access to at least one Xero org.",
  save_failed: "Failed to save your Xero connection. Please try again.",
  missing_params: "Invalid callback from Xero. Please try connecting again.",
};

export function XeroConnectPanel({ connections, justConnected, connectError }: Props) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  async function handleDisconnect(tenantId: string, tenantName: string | null) {
    setDisconnecting(tenantId);
    try {
      const res = await fetch("/api/xero/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to disconnect Xero");
        return;
      }
      toast.success(`Disconnected from ${tenantName ?? "Xero"}`);
      router.refresh();
    } catch {
      toast.error("Failed to disconnect Xero");
    } finally {
      setDisconnecting(null);
    }
  }

  const errorMessage = connectError
    ? (ERROR_MESSAGES[connectError] ?? "An error occurred connecting to Xero.")
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {/* Xero logo placeholder — replace with official Xero branding when submitting to App Store */}
          <div className="w-10 h-10 rounded-lg bg-[#13B5EA] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">X</span>
          </div>
          <div>
            <CardTitle className="text-base">Xero</CardTitle>
            <CardDescription className="text-xs">
              Export your property financials directly into Xero for tax return preparation
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {justConnected && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Successfully connected to Xero.
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        {connections.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Xero account to export property investment data as Manual Journals,
              ready for your accountant to use in a tax return.
            </p>
            <a
              href="/api/xero/connect"
              className={cn(buttonVariants({ variant: "default" }))}
            >
              Connect to Xero
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.tenant_id}
                className="flex items-center justify-between rounded-md border px-3 py-2.5"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {conn.tenant_name ?? "Xero Organisation"}
                    </span>
                    <Badge variant="secondary" className="text-xs">Connected</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connected {new Date(conn.connected_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://go.xero.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "flex items-center gap-1",
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Xero
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disconnecting === conn.tenant_id}
                    onClick={() => handleDisconnect(conn.tenant_id, conn.tenant_name)}
                  >
                    {disconnecting === conn.tenant_id ? "Disconnecting…" : "Disconnect"}
                  </Button>
                </div>
              </div>
            ))}

            <a
              href="/api/xero/connect"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Connect another organisation
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

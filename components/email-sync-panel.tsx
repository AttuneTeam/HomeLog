"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";

interface IngestionLogEntry {
  id: string;
  received_at: string;
  sender_address: string | null;
  raw_subject: string | null;
  status: string;
  extracted_type: string | null;
  parse_notes: string | null;
}

interface Props {
  userId: string;
  inboundDomain: string;
  recentLog: IngestionLogEntry[];
  isDev: boolean;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  parsed: { label: "Parsed", variant: "default" },
  unmatched: { label: "Unmatched", variant: "outline" },
  duplicate: { label: "Duplicate", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

export function EmailSyncPanel({ userId, inboundDomain, recentLog, isDev }: Props) {
  const inboundAddress = `sync+${userId}@${inboundDomain}`;
  const [copied, setCopied] = useState(false);

  // Simulate form state
  const [simSender, setSimSender] = useState("");
  const [simSubject, setSimSubject] = useState("");
  const [simBody, setSimBody] = useState("");
  const [simFile, setSimFile] = useState<File | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{ status: string; log?: IngestionLogEntry } | null>(null);

  function copyAddress() {
    navigator.clipboard.writeText(inboundAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSimulate() {
    if (!simSender || !simSubject || (!simBody && !simFile)) {
      toast.error("Fill in sender, subject, and a body or attachment");
      return;
    }
    setSimulating(true);
    setSimResult(null);
    try {
      const form = new FormData();
      form.set("sender", simSender);
      form.set("subject", simSubject);
      form.set("bodyText", simBody);
      form.set("userId", userId);
      if (simFile) form.set("file", simFile);

      const res = await fetch("/api/inbound-email/simulate", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setSimResult(data);
      toast.success(`Simulate result: ${data.status}`);
    } catch {
      toast.error("Simulate request failed");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Inbound address */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Email sync</CardTitle>
              <CardDescription className="text-xs">
                Forward agent emails to automatically record payments and expenses
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Your inbound address</Label>
            <div className="flex gap-2">
              <Input value={inboundAddress} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="sm" onClick={copyAddress} className="shrink-0 gap-1.5">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
            <p className="font-medium">Setup instructions</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>Open your email client (Gmail, Outlook, Apple Mail, etc.)</li>
              <li>Create a forwarding rule: <em>when sender is your agent&apos;s email</em>, forward to the address above</li>
              <li>Add your agent&apos;s email address to each rental period (Properties → select property → Rental periods → Edit)</li>
            </ol>
            <p className="text-xs text-muted-foreground pt-1">
              Once set up, agent emails are automatically parsed and recorded — no manual entry needed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription className="text-xs">Last 20 processed emails</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No emails received yet. Set up forwarding to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {recentLog.map((entry) => {
                const badge = STATUS_BADGE[entry.status] ?? { label: entry.status, variant: "secondary" as const };
                return (
                  <div key={entry.id} className="flex items-start justify-between rounded-md border px-3 py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.raw_subject ?? "(no subject)"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {entry.sender_address} · {new Date(entry.received_at).toLocaleDateString("en-AU", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                      {entry.parse_notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {entry.parse_notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                      {entry.extracted_type && (
                        <span className="text-xs text-muted-foreground">{entry.extracted_type.replace("_", " ")}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dev simulate panel */}
      {isDev && (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Simulate incoming email</CardTitle>
            </div>
            <CardDescription className="text-xs">Dev only — test the parse pipeline without Cloudflare</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sim-sender">Sender email</Label>
              <Input id="sim-sender" placeholder="agent@raywhite.com.au" value={simSender} onChange={(e) => setSimSender(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-subject">Subject</Label>
              <Input id="sim-subject" placeholder="Rental statement — 123 Main St" value={simSubject} onChange={(e) => setSimSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-body">Email body</Label>
              <Textarea id="sim-body" placeholder="Paste email body here…" rows={5} value={simBody} onChange={(e) => setSimBody(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sim-file">Attachment (PDF or image, optional)</Label>
              <Input
                id="sim-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                onChange={(e) => setSimFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Attach a water bill or repair invoice to test attachment OCR end-to-end
              </p>
            </div>
            <Button onClick={handleSimulate} disabled={simulating} size="sm">
              {simulating ? "Parsing…" : "Run simulate"}
            </Button>
            {simResult && (
              <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48">
                {JSON.stringify(simResult, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

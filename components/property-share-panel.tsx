"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Share2,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  UserPlus,
  Link2,
  X,
  Clock,
} from "lucide-react";
import { PropertyShare } from "@/lib/supabase/database.types";

interface Props {
  propertyId: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function statusBadge(status: string) {
  if (status === "active")
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Active
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  return null;
}

type Tab = "viewers" | "passport";

export function PropertySharePanel({ propertyId }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("viewers");

  // Viewer invite state
  const [email, setEmail] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [shares, setShares] = useState<PropertyShare[]>([]);

  // Passport state
  const [passportToken, setPassportToken] = useState<string | null>(null);
  const [loadingPassport, setLoadingPassport] = useState(false);

  // Load shares and passport link when dialog opens
  useEffect(() => {
    if (!open) return;
    async function load() {
      const [sharesRes, passportRes] = await Promise.all([
        fetch(`/api/sharing/property/${propertyId}`),
        fetch(`/api/passport/${propertyId}`),
      ]);
      if (sharesRes.ok) {
        const data = await sharesRes.json();
        setShares(
          (data.shares ?? []).filter(
            (s: PropertyShare) => s.status !== "revoked"
          )
        );
      }
      if (passportRes.ok) {
        const data = await passportRes.json();
        setPassportToken(data.link?.share_token ?? null);
      }
    }
    load();
  }, [open, propertyId]);

  async function handleInviteViewer(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoadingInvite(true);
    try {
      const res = await fetch(`/api/sharing/property/${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create invite");
        return;
      }
      setShares((prev) => [json.share, ...prev]);
      setInviteUrl(json.inviteUrl);
      setEmail("");
      toast.success("Invite created");
    } finally {
      setLoadingInvite(false);
    }
  }

  async function handleRevokeShare(shareId: string) {
    const res = await fetch(`/api/sharing/property/${propertyId}/${shareId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to revoke access");
      return;
    }
    setShares((prev) => prev.filter((s) => s.id !== shareId));
    toast.success("Access revoked");
  }

  async function handleGeneratePassport() {
    setLoadingPassport(true);
    try {
      const res = await fetch(`/api/passport/${propertyId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to generate link");
        return;
      }
      setPassportToken(json.link.share_token);
      toast.success("Passport link generated");
    } finally {
      setLoadingPassport(false);
    }
  }

  async function handleRevokePassport() {
    const res = await fetch(`/api/passport/${propertyId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to revoke passport link");
      return;
    }
    setPassportToken(null);
    toast.success("Passport link revoked");
  }

  const passportUrl = passportToken
    ? `${window.location.origin}/passport/${passportToken}`
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Share2 className="h-3.5 w-3.5 mr-1.5" />
        Share
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Property</DialogTitle>
        </DialogHeader>

        {/* Tab nav */}
        <div className="flex border-b mb-4 -mt-2">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "viewers"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("viewers")}
          >
            <UserPlus className="h-3.5 w-3.5 inline mr-1.5" />
            Viewers
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === "passport"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("passport")}
          >
            <Link2 className="h-3.5 w-3.5 inline mr-1.5" />
            Passport Link
          </button>
        </div>

        {tab === "viewers" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Give read-only access to a specific person (e.g. your accountant).
              They&apos;ll need to create an account if they don&apos;t have one.
            </p>

            <form onSubmit={handleInviteViewer} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="viewer-email" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="viewer-email"
                  type="email"
                  placeholder="accountant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loadingInvite}
                />
              </div>
              <Button type="submit" size="sm" disabled={loadingInvite || !email.trim()}>
                Invite
              </Button>
            </form>

            {inviteUrl && (
              <div className="rounded-md border bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Share this link with the recipient
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs flex-1 truncate min-w-0">{inviteUrl}</code>
                  <CopyButton text={inviteUrl} />
                </div>
              </div>
            )}

            {shares.length > 0 && (
              <div className="divide-y rounded-md border">
                {shares.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{s.grantee_email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(s.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevokeShare(s.id)}
                        title="Revoke access"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "passport" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate a public link that anyone can open to view this
              property&apos;s history — no login required. Useful for handing
              history to a buyer.
            </p>

            {passportUrl ? (
              <>
                <div className="rounded-md border bg-muted/50 p-3 space-y-1 overflow-hidden">
                  <p className="text-xs font-medium text-muted-foreground">
                    Public passport link
                  </p>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <code className="text-xs flex-1 truncate min-w-0 block">{passportUrl}</code>
                    <CopyButton text={passportUrl} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePassport}
                    disabled={loadingPassport}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleRevokePassport}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Revoke
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={handleGeneratePassport} disabled={loadingPassport}>
                <Link2 className="h-4 w-4 mr-1.5" />
                {loadingPassport ? "Generating…" : "Generate passport link"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

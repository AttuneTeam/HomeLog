"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Copy,
  Check,
  X,
  Clock,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountMember } from "@/lib/supabase/database.types";

interface SharedWithMeEntry {
  id: string;
  owner_id: string;
  status: string;
  profiles?: { display_name: string | null } | null;
}

interface Props {
  myMembers: AccountMember[];
  sharedWithMe: SharedWithMeEntry[];
  currentUserEmail: string;
  isGuest?: boolean;
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
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Active
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  if (status === "declined")
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Declined
      </span>
    );
  return null;
}

export function SharingSettingsClient({ myMembers, sharedWithMe, currentUserEmail, isGuest = false }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<AccountMember[]>(myMembers);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sharing/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create invite");
        return;
      }
      setMembers((prev) => [json.member, ...prev]);
      setInviteUrl(json.inviteUrl);
      setEmail("");
      toast.success("Invite created");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(memberId: string) {
    const res = await fetch(`/api/sharing/account/${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to revoke access");
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, status: "revoked" as const } : m))
    );
    toast.success("Access revoked");
  }

  const activeMembers = members.filter(
    (m) => m.status === "active" || m.status === "pending",
  );

  return (
    <div className="space-y-8">
      {/* Household Members */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">Household Members</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Invite someone to have full access to all your properties and financial
          data. Ideal for a partner or spouse.
        </p>

        {isGuest ? (
          <p className="text-sm text-muted-foreground italic">
            Inviting additional members is not available while you are a guest on another account.
          </p>
        ) : (
          <form onSubmit={handleInvite} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-email" className="sr-only">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="partner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !email.trim()}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Invite
            </Button>
          </form>
        )}

        {!isGuest && inviteUrl && (
          <div className="rounded-md border bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Share this invite link with the recipient
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 truncate">{inviteUrl}</code>
              <CopyButton text={inviteUrl} />
            </div>
          </div>
        )}

        {activeMembers.length > 0 ? (
          <div className="divide-y rounded-md border">
            {activeMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.grantee_email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role.replace("_", " ")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(m.status)}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevoke(m.id)}
                    title="Revoke access"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No members invited yet.</p>
        )}
      </section>

      {/* Properties shared with me */}
      {sharedWithMe.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Shared With Me</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Accounts where you have been granted access.
          </p>
          <div className="divide-y rounded-md border">
            {sharedWithMe.map((entry) => {
              const ownerName = entry.profiles?.display_name ?? "Unknown";
              return (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ownerName}&rsquo;s account</p>
                    <p className="text-xs text-muted-foreground">Co-owner</p>
                  </div>
                  {statusBadge(entry.status)}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

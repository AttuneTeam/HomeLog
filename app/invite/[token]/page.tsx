import Link from "next/link";
import { Users, Building2 } from "lucide-react";
import Image from "next/image";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { InviteAcceptButton } from "@/components/invite-accept-button";
import { InviteSignupForm } from "@/components/invite-signup-form";

async function emailHasAccount(admin: ReturnType<typeof createAdminClient>, email: string): Promise<boolean> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
  return !!data?.users?.find((u) => u.email === email);
}

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  const [supabase, admin] = await Promise.all([createClient(), Promise.resolve(createAdminClient())]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch invite data via admin client so unauthenticated visitors can see invite context
  const { data: accountMember, error: accountMemberError } = await admin
    .from("account_members")
    .select("id, status, owner_id, role, grantee_email")
    .eq("invite_token", token)
    .maybeSingle();

  if (accountMemberError) {
    console.error("[invite/page] account_members query failed", { token, error: accountMemberError.message, code: accountMemberError.code });
  }

  if (accountMember) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", accountMember.owner_id)
      .maybeSingle();

    const ownerName = ownerProfile?.display_name ?? "Someone";
    const isRevoked = accountMember.status === "revoked" || accountMember.status === "declined";
    const alreadyActive = accountMember.status === "active";

    if (!user) {
      const accountExists = !isRevoked && !alreadyActive
        ? await emailHasAccount(admin, accountMember.grantee_email)
        : false;

      return (
        <InviteShell
          icon={<Users className="h-8 w-8 text-primary" />}
          title={`${ownerName} invited you to their Home Base account`}
          description="As a co-owner you'll have full access to their properties, renovations, and financial data."
        >
          {isRevoked ? (
            <p className="text-center text-sm text-destructive">This invite has been revoked.</p>
          ) : alreadyActive ? (
            <p className="text-center text-sm text-muted-foreground">
              This invite has already been accepted.{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </p>
          ) : accountExists ? (
            <SignInToAccept token={token} email={accountMember.grantee_email} />
          ) : (
            <InviteSignupForm token={token} inviteEmail={accountMember.grantee_email} inviteType="account" />
          )}
        </InviteShell>
      );
    }

    // Authenticated — verify this invite belongs to the signed-in user
    if (user.email !== accountMember.grantee_email) {
      return (
        <NotForYou
          inviteEmail={accountMember.grantee_email}
          userEmail={user.email ?? ""}
        />
      );
    }

    return (
      <InviteShell
        icon={<Users className="h-8 w-8 text-primary" />}
        title={`${ownerName} invited you to their account`}
        description="As a co-owner you'll have full access to their properties, renovations, and financial data."
      >
        {isRevoked ? (
          <p className="text-center text-sm text-destructive">This invite has been revoked.</p>
        ) : alreadyActive ? (
          <p className="text-center text-sm text-muted-foreground">
            You&apos;ve already accepted this invite.{" "}
            <Link href="/" className="underline">
              Go to dashboard
            </Link>
          </p>
        ) : (
          <InviteAcceptButton token={token} />
        )}
      </InviteShell>
    );
  }

  const { data: propertyShare, error: propertyShareError } = await admin
    .from("property_shares")
    .select("id, status, owner_id, property_id, grantee_email")
    .eq("invite_token", token)
    .maybeSingle();

  if (propertyShareError) {
    console.error("[invite/page] property_shares query failed", { token, error: propertyShareError.message, code: propertyShareError.code });
  }

  if (propertyShare) {
    const [{ data: ownerProfile }, { data: property }] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", propertyShare.owner_id).maybeSingle(),
      admin.from("properties").select("address").eq("id", propertyShare.property_id).maybeSingle(),
    ]);

    const ownerName = ownerProfile?.display_name ?? "Someone";
    const address = property?.address ?? "a property";
    const isRevoked = propertyShare.status === "revoked" || propertyShare.status === "declined";
    const alreadyActive = propertyShare.status === "active";

    if (!user) {
      const accountExists = !isRevoked && !alreadyActive
        ? await emailHasAccount(admin, propertyShare.grantee_email)
        : false;

      return (
        <InviteShell
          icon={<Building2 className="h-8 w-8 text-primary" />}
          title={`${ownerName} shared ${address} with you`}
          description="As a viewer you'll have read-only access to this property's history, documents, and financial data."
        >
          {isRevoked ? (
            <p className="text-center text-sm text-destructive">This invite has been revoked.</p>
          ) : alreadyActive ? (
            <p className="text-center text-sm text-muted-foreground">
              This invite has already been accepted.{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </p>
          ) : accountExists ? (
            <SignInToAccept token={token} email={propertyShare.grantee_email} />
          ) : (
            <InviteSignupForm token={token} inviteEmail={propertyShare.grantee_email} inviteType="property" propertyId={propertyShare.property_id} />
          )}
        </InviteShell>
      );
    }

    if (user.email !== propertyShare.grantee_email) {
      return (
        <NotForYou
          inviteEmail={propertyShare.grantee_email}
          userEmail={user.email ?? ""}
        />
      );
    }

    return (
      <InviteShell
        icon={<Building2 className="h-8 w-8 text-primary" />}
        title={`${ownerName} shared ${address} with you`}
        description="As a viewer you'll have read-only access to this property's history, documents, and financial data."
      >
        {isRevoked ? (
          <p className="text-center text-sm text-destructive">This invite has been revoked.</p>
        ) : alreadyActive ? (
          <p className="text-center text-sm text-muted-foreground">
            You&apos;ve already accepted this invite.{" "}
            <Link href="/" className="underline">
              Go to dashboard
            </Link>
          </p>
        ) : (
          <InviteAcceptButton token={token} />
        )}
      </InviteShell>
    );
  }

  // Token not found
  console.warn("[invite/page] token not found in any table", { token });
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <p className="text-muted-foreground">This invite link is invalid or has expired.</p>
        {user && (
          <Link href="/" className="text-sm underline">
            Go to dashboard
          </Link>
        )}
        {!user && (
          <Link href="/login" className="text-sm underline">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}

function InviteShell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <Image src="/logo.png" alt="Home Base" width={120} height={94} className="h-8 w-auto" />
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex justify-center">{icon}</div>
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function SignInToAccept({ token, email }: { token: string; email: string }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted-foreground">
        <strong>{email}</strong> already has an account. Sign in to accept this invitation.
      </p>
      <Link
        href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Sign in to accept
      </Link>
    </div>
  );
}

function NotForYou({ inviteEmail, userEmail }: { inviteEmail: string; userEmail: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <p className="text-muted-foreground">
          This invite was sent to <strong>{inviteEmail}</strong>, but you&apos;re signed in as{" "}
          <strong>{userEmail}</strong>.
        </p>
        <Link href="/" className="text-sm underline">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Home Base <invites@homebase.attune.com.au>";

export async function sendAccountInviteEmail({
  to,
  inviterName,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  inviteUrl: string;
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to their Home Base account`,
    html: `
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has invited you to access their Home Base account as a co-owner. You'll have full access to their properties, renovations, and financial data.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Accept invitation</a></p>
      <p>If the button doesn't work, copy and paste this link:<br>${inviteUrl}</p>
      <p style="color:#71717a;font-size:12px;">This invitation does not expire. If you didn't expect this email, you can safely ignore it.</p>
    `,
  });
}

export async function sendPropertyInviteEmail({
  to,
  inviterName,
  address,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  address: string;
  inviteUrl: string;
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} shared ${address} with you`,
    html: `
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has shared <strong>${address}</strong> with you on Home Base. You'll have read-only access to the property's history, documents, and financial data.</p>
      <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View property</a></p>
      <p>If the button doesn't work, copy and paste this link:<br>${inviteUrl}</p>
      <p style="color:#71717a;font-size:12px;">This invitation does not expire. If you didn't expect this email, you can safely ignore it.</p>
    `,
  });
}

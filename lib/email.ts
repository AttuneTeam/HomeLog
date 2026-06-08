import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM =
  process.env.RESEND_FROM_EMAIL ?? "Home Base <noreply@yourhomebase.au>";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://yourhomebase.au";

/**
 * Branded HTML shell so every transactional email looks consistent.
 */
function renderLayout({
  title,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f3f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f3;padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#fbf9f9;border:1px solid #e6e3e3;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 24px;">
                <a href="${APP_URL}" style="text-decoration:none;">
                  <img src="${APP_URL}/logo.png" alt="Home Base" width="120" height="auto" style="display:block;border:0;max-width:120px;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px;">
                <h1 style="margin:0;font-size:22px;font-weight:600;color:#030813;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 24px;font-size:15px;line-height:1.6;color:#45474c;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <a href="${ctaUrl}" style="display:inline-block;background-color:#030813;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;padding:14px 28px;border-radius:4px;">${ctaLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;font-size:12px;line-height:1.5;color:#9a9a9f;border-top:1px solid #e6e3e3;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${ctaUrl}" style="color:#9a9a9f;word-break:break-all;">${ctaUrl}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Sends an email via Resend. Logs and swallows errors so a mail failure never
 * breaks the calling request handler.
 */
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error("[email] send failed:", subject, error);
    }
  } catch (err) {
    console.error("[email] send threw:", subject, err);
  }
}

export async function sendAccountInviteEmail({
  to,
  inviterName,
  inviteUrl,
}: {
  to: string;
  inviterName: string;
  inviteUrl: string;
}): Promise<void> {
  await sendEmail({
    to,
    subject: `${inviterName} invited you to their Home Base account`,
    html: renderLayout({
      title: "You've been invited",
      bodyHtml: `<p style="margin:0 0 12px;"><strong>${inviterName}</strong> invited you to join their Home Base account, where you can co-manage their properties.</p><p style="margin:0;">Click below to accept the invitation and set up your account.</p>`,
      ctaLabel: "Accept invitation",
      ctaUrl: inviteUrl,
    }),
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
}): Promise<void> {
  await sendEmail({
    to,
    subject: `${inviterName} shared ${address} with you`,
    html: renderLayout({
      title: "A property was shared with you",
      bodyHtml: `<p style="margin:0 0 12px;"><strong>${inviterName}</strong> shared <strong>${address}</strong> with you on Home Base.</p><p style="margin:0;">Click below to view the property and set up your account.</p>`,
      ctaLabel: "View property",
      ctaUrl: inviteUrl,
    }),
  });
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  await sendEmail({
    to,
    subject: "Reset your Home Base password",
    html: renderLayout({
      title: "Reset your password",
      bodyHtml: `<p style="margin:0 0 12px;">We received a request to reset the password for your Home Base account.</p><p style="margin:0;">Click below to choose a new password. If you didn't request this, you can safely ignore this email.</p>`,
      ctaLabel: "Reset password",
      ctaUrl: resetUrl,
    }),
  });
}

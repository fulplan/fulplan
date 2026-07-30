import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Uptilll <noreply@uptilll.com>";

function log(msg: string) {
  if (!resend) console.log("[email:dev]", msg);
}

export async function sendWelcomeEmail(to: string, orgName: string): Promise<void> {
  log(`welcome → ${to} (${orgName})`);
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Welcome to GhPOS — ${orgName} is ready`,
    html: `<p>Hi,</p>
<p>Your organisation <strong>${orgName}</strong> has been created on GhPOS. You have a <strong>14-day free trial</strong> on Uptilll — no card required.</p>
<p>Log in at <a href="https://app.uptilll.com">app.ghpos.app</a> to get started.</p>
<p>— The GhPOS Team</p>`,
  });
}

export async function sendTrialWarningEmail(
  to: string,
  orgName: string,
  daysLeft: number
): Promise<void> {
  log(`trial warning (${daysLeft}d) → ${to}`);
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your GhPOS trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    html: `<p>Hi,</p>
<p>Your GhPOS trial for <strong>${orgName}</strong> expires in <strong>${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong>.</p>
<p>Upgrade now to keep your data and avoid interruption: <a href="https://app.uptilll.com/settings/billing">Upgrade plan</a></p>
<p>— The GhPOS Team</p>`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  log(`password reset → ${to}`);
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your GhPOS password",
    html: `<p>Hi,</p>
<p>Click the link below to reset your password. It expires in 1 hour.</p>
<p><a href="${resetUrl}">Reset password</a></p>
<p>If you did not request this, ignore this email.</p>
<p>— The GhPOS Team</p>`,
  });
}

export async function sendReceiptEmail(
  to: string,
  orgName: string,
  saleId: string,
  totalGhs: string
): Promise<void> {
  log(`receipt → ${to} sale=${saleId}`);
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Receipt from ${orgName} — GHS ${totalGhs}`,
    html: `<p>Thank you for shopping at <strong>${orgName}</strong>.</p>
<p>Sale reference: <code>${saleId}</code><br/>Total: <strong>GHS ${totalGhs}</strong></p>
<p>Contact the store if you have any questions.</p>`,
  });
}

// Transactional email for flows we send ourselves (i.e. not the NextAuth
// magic-link, which the EmailProvider handles internally). Reuses the same
// discrete EMAIL_SERVER_* / EMAIL_FROM env vars already configured for auth —
// see src/auth.ts and .env.example.

import nodemailer from 'nodemailer';

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

/**
 * Email the confirmation link to the address a user wants to switch TO. Clicking
 * it is what actually applies the change (see the email/verify route) — the link
 * is the proof they control the new inbox, so we never mutate User.email until
 * this lands.
 */
export async function sendEmailChangeVerification(params: {
  to: string;
  url: string;
  currentEmail: string | null;
}) {
  const { to, url, currentEmail } = params;
  const transport = buildTransport();

  const escapedUrl = url.replace(/&/g, '&amp;');

  await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM,
    subject: 'Confirm your new StudyPet+ email address',
    text: [
      'You (or someone signed in to your StudyPet+ account) asked to change the',
      `account email${currentEmail ? ` from ${currentEmail}` : ''} to this address.`,
      '',
      'Confirm the change by opening this link:',
      url,
      '',
      "This link expires in 1 hour. If you didn't request this, you can safely",
      'ignore this email — your account email will not change.',
    ].join('\n'),
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h1 style="font-size: 20px;">Confirm your new email address</h1>
        <p style="font-size: 14px; line-height: 1.6;">
          You (or someone signed in to your StudyPet+ account) asked to change the
          account email${currentEmail ? ` from <strong>${currentEmail}</strong>` : ''}
          to <strong>${to}</strong>.
        </p>
        <p style="margin: 24px 0;">
          <a href="${escapedUrl}"
             style="display: inline-block; background: #4f46e5; color: #ffffff;
                    text-decoration: none; padding: 12px 20px; border-radius: 10px;
                    font-weight: 600; font-size: 14px;">
            Confirm email change
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
          This link expires in 1 hour. If you didn't request this, you can safely
          ignore this email &mdash; your account email will not change.
        </p>
      </div>
    `,
  });
}

/**
 * Tell the address the account is moving AWAY from that a change was requested.
 *
 * The confirmation link goes only to the new address, so without this the
 * account's current owner never hears about an identity change made from a
 * stolen session — the first they'd know is being unable to sign in. This is
 * the out-of-band channel, and it carries the cancel link so the change can be
 * killed from the mailbox that still works.
 *
 * Best-effort by design: the caller must not fail the request if it bounces.
 */
export async function sendEmailChangeAlert(params: {
  to: string;
  newEmail: string;
  cancelUrl: string;
}) {
  const { to, newEmail, cancelUrl } = params;
  const transport = buildTransport();

  const escapedUrl = cancelUrl.replace(/&/g, '&amp;');

  await transport.sendMail({
    to,
    from: process.env.EMAIL_FROM,
    subject: 'Security alert: your StudyPet+ email is being changed',
    text: [
      `Someone signed in to your StudyPet+ account asked to move it to ${newEmail}.`,
      '',
      "If that was you, there's nothing to do — just confirm the link we sent to",
      'the new address.',
      '',
      "If it wasn't you, cancel the change now:",
      cancelUrl,
      '',
      'The request expires on its own in 1 hour. We recommend signing out of all',
      'devices and reviewing your two-factor settings if you did not request this.',
    ].join('\n'),
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h1 style="font-size: 20px;">Your account email is being changed</h1>
        <p style="font-size: 14px; line-height: 1.6;">
          Someone signed in to your StudyPet+ account asked to move it to
          <strong>${newEmail}</strong>.
        </p>
        <p style="font-size: 14px; line-height: 1.6;">
          If that was you, there&rsquo;s nothing to do &mdash; just confirm the
          link we sent to the new address.
        </p>
        <p style="margin: 24px 0;">
          <a href="${escapedUrl}"
             style="display: inline-block; background: #dc2626; color: #ffffff;
                    text-decoration: none; padding: 12px 20px; border-radius: 10px;
                    font-weight: 600; font-size: 14px;">
            Cancel this change
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">
          The request expires on its own in 1 hour. If you did not request this,
          we recommend signing out of all devices and reviewing your two-factor
          settings.
        </p>
      </div>
    `,
  });
}

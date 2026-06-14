import { Resend } from "resend";
import { buildAuthEmail, buildLibraryInviteEmail, type AuthEmailAction } from "@/lib/email/email-templates";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export function getEmailFrom() {
  return process.env.EMAIL_FROM ?? "wenlo <onboarding@resend.dev>";
}

export async function sendEmail(input: SendEmailInput) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", input.to);
    return { ok: false as const, skipped: true as const };
  }

  const { error } = await resend.emails.send({
    from: getEmailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    console.error("[email] send failed:", error);
    return { ok: false as const, skipped: false as const, error: error.message };
  }

  return { ok: true as const };
}

type LibraryInviteEmailInput = {
  to: string;
  libraryName: string;
  inviterName: string;
  inviterEmail: string;
  role: "EDITOR" | "VIEWER";
  message?: string | null;
  acceptUrl: string;
};

export async function sendLibraryInviteEmail(input: LibraryInviteEmailInput) {
  const { subject, html, text } = buildLibraryInviteEmail({
    libraryName: input.libraryName,
    inviterName: input.inviterName,
    role: input.role,
    message: input.message,
    acceptUrl: input.acceptUrl,
  });
  return sendEmail({ to: input.to, subject, html, text });
}

type AuthEmailSendInput = {
  to: string;
  action: AuthEmailAction;
  confirmationUrl?: string;
  token?: string;
  newEmail?: string;
};

export async function sendAuthEmail(input: AuthEmailSendInput) {
  const { subject, html, text } = buildAuthEmail({
    action: input.action,
    confirmationUrl: input.confirmationUrl,
    token: input.token,
    newEmail: input.newEmail,
  });
  return sendEmail({ to: input.to, subject, html, text });
}

export { buildLibraryInviteEmail, buildAuthEmail, renderInviteSubject } from "@/lib/email/email-templates";

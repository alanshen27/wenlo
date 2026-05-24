export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const emailStyles = {
  body: "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111;",
  muted: "color: #666; font-size: 14px;",
  button:
    "display: inline-block; padding: 10px 16px; background: #111; color: #fff; text-decoration: none; border-radius: 6px;",
  quote:
    "margin: 16px 0; padding: 12px 16px; border-left: 3px solid #ddd; color: #444;",
  code: "font-size: 24px; font-weight: 600; letter-spacing: 0.2em;",
};

type EmailLayoutInput = {
  title: string;
  bodyHtml: string;
  actionUrl?: string;
  actionLabel?: string;
  footer?: string;
  code?: string;
};

export function buildEmailLayout(input: EmailLayoutInput) {
  const html = `
    <div style="${emailStyles.body}">
      <p style="font-size: 16px; font-weight: 600; margin: 0 0 12px;">${escapeHtml(input.title)}</p>
      ${input.bodyHtml}
      ${
        input.code
          ? `<p style="${emailStyles.code}">${escapeHtml(input.code)}</p>`
          : ""
      }
      ${
        input.actionUrl && input.actionLabel
          ? `<p style="margin: 20px 0;">
              <a href="${escapeHtml(input.actionUrl)}" style="${emailStyles.button}">
                ${escapeHtml(input.actionLabel)}
              </a>
            </p>`
          : ""
      }
      ${
        input.footer
          ? `<p style="${emailStyles.muted}">${escapeHtml(input.footer)}</p>`
          : ""
      }
    </div>
  `.trim();

  const textParts = [input.title];
  if (input.bodyHtml) {
    textParts.push(stripHtml(input.bodyHtml));
  }
  if (input.code) textParts.push(`Code: ${input.code}`);
  if (input.actionUrl) textParts.push(`${input.actionLabel ?? "Open link"}: ${input.actionUrl}`);
  if (input.footer) textParts.push(input.footer);

  return { html, text: textParts.filter(Boolean).join("\n\n") };
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type AuthEmailAction =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | "reauthentication"
  | "email"
  | "password_changed_notification"
  | "email_changed_notification"
  | "phone_changed_notification"
  | "identity_linked_notification"
  | "identity_unlinked_notification"
  | "mfa_factor_enrolled_notification"
  | "mfa_factor_unenrolled_notification";

type AuthEmailInput = {
  action: AuthEmailAction;
  confirmationUrl?: string;
  token?: string;
  newEmail?: string;
};

const authSubjects: Record<string, string> = {
  signup: "Confirm your recall account",
  recovery: "Reset your recall password",
  magiclink: "Sign in to recall",
  invite: "You've been invited to recall",
  email_change: "Confirm your new email for recall",
  reauthentication: "Your recall verification code",
  email: "Confirm your recall account",
  password_changed_notification: "Your recall password was changed",
  email_changed_notification: "Your recall email was changed",
  phone_changed_notification: "Your recall phone number was changed",
  identity_linked_notification: "A sign-in method was linked to recall",
  identity_unlinked_notification: "A sign-in method was removed from recall",
  mfa_factor_enrolled_notification: "Two-factor authentication enabled on recall",
  mfa_factor_unenrolled_notification: "Two-factor authentication disabled on recall",
};

export function buildAuthEmail(input: AuthEmailInput) {
  const subject =
    process.env[`AUTH_EMAIL_SUBJECT_${input.action.toUpperCase()}`] ??
    authSubjects[input.action] ??
    "recall notification";

  switch (input.action) {
    case "signup":
    case "email":
      return {
        subject,
        ...buildEmailLayout({
          title: "Confirm your email",
          bodyHtml: `<p>Thanks for signing up for recall. Confirm your email to finish creating your account.</p>`,
          actionUrl: input.confirmationUrl,
          actionLabel: "Confirm email",
          code: input.token,
          footer: "If you didn't create an account, you can ignore this email.",
        }),
      };
    case "recovery":
      return {
        subject,
        ...buildEmailLayout({
          title: "Reset your password",
          bodyHtml: `<p>We received a request to reset your recall password.</p>`,
          actionUrl: input.confirmationUrl,
          actionLabel: "Reset password",
          code: input.token,
          footer: "If you didn't request this, you can safely ignore this email.",
        }),
      };
    case "magiclink":
      return {
        subject,
        ...buildEmailLayout({
          title: "Sign in to recall",
          bodyHtml: `<p>Use the link below to sign in. It expires shortly and works once.</p>`,
          actionUrl: input.confirmationUrl,
          actionLabel: "Sign in",
          code: input.token,
        }),
      };
    case "invite":
      return {
        subject,
        ...buildEmailLayout({
          title: "You've been invited to recall",
          bodyHtml: `<p>You've been invited to create a recall account.</p>`,
          actionUrl: input.confirmationUrl,
          actionLabel: "Accept invitation",
        }),
      };
    case "email_change":
      return {
        subject,
        ...buildEmailLayout({
          title: "Confirm your new email",
          bodyHtml: `<p>Confirm ${escapeHtml(input.newEmail ?? "your new email address")} for your recall account.</p>`,
          actionUrl: input.confirmationUrl,
          actionLabel: "Confirm new email",
          code: input.token,
          footer: "If you didn't request this change, you can ignore this email.",
        }),
      };
    case "reauthentication":
      return {
        subject,
        ...buildEmailLayout({
          title: "Verification code",
          bodyHtml: `<p>Enter this code to verify your identity:</p>`,
          code: input.token,
        }),
      };
    default:
      return {
        subject,
        ...buildEmailLayout({
          title: "Account update",
          bodyHtml: `<p>There was a security update on your recall account.</p>`,
          footer: "If this wasn't you, sign in and review your account settings.",
        }),
      };
  }
}

type LibraryInviteEmailInput = {
  libraryName: string;
  inviterName: string;
  role: "EDITOR" | "VIEWER";
  message?: string | null;
  acceptUrl: string;
};

export function renderInviteSubject(libraryName: string, inviterName: string) {
  const template =
    process.env.INVITE_EMAIL_SUBJECT ?? "{{inviter}} invited you to {{library}} on recall";
  return template
    .replace(/\{\{inviter\}\}/g, inviterName)
    .replace(/\{\{library\}\}/g, libraryName);
}

export function buildLibraryInviteEmail(input: LibraryInviteEmailInput) {
  const roleLabel = input.role === "EDITOR" ? "Editor" : "Viewer";
  const customMessage = input.message?.trim();
  const subject = renderInviteSubject(input.libraryName, input.inviterName);

  const bodyHtml = `
    <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to collaborate on <strong>${escapeHtml(input.libraryName)}</strong> on recall.</p>
    <p>Role: ${roleLabel}</p>
    ${
      customMessage
        ? `<blockquote style="${emailStyles.quote}">${escapeHtml(customMessage).replace(/\n/g, "<br />")}</blockquote>`
        : ""
    }
    <p style="${emailStyles.muted}">You'll need to accept the invite before you can access this workspace.</p>
  `.trim();

  return {
    subject,
    ...buildEmailLayout({
      title: "Workspace invitation",
      bodyHtml,
      actionUrl: input.acceptUrl,
      actionLabel: "View invitation",
    }),
  };
}

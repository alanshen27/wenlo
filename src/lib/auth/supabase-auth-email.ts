import { Webhook } from "standardwebhooks";
import { sendAuthEmail } from "@/lib/email/email";
import type { AuthEmailAction } from "@/lib/email/email-templates";

export type SupabaseAuthEmailPayload = {
  user: {
    email: string;
    new_email?: string;
    user_metadata?: {
      full_name?: string;
      i18n?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthEmailAction;
    site_url: string;
    token_new: string;
    token_hash_new: string;
    old_email?: string;
  };
};

function getHookSecret() {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return null;
  return secret.replace(/^v1,whsec_/, "");
}

export function verifySupabaseAuthEmailPayload(
  payload: string,
  headers: Record<string, string>
): SupabaseAuthEmailPayload {
  const secret = getHookSecret();
  if (!secret) {
    throw new Error("SEND_EMAIL_HOOK_SECRET not configured");
  }

  const webhook = new Webhook(secret);
  return webhook.verify(payload, headers) as SupabaseAuthEmailPayload;
}

export function buildSupabaseConfirmationUrl(
  emailData: SupabaseAuthEmailPayload["email_data"],
  tokenHash: string
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL not configured");
  }

  const params = new URLSearchParams({
    token: tokenHash,
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to || getAppRedirectFallback(),
  });

  return `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
}

function getAppRedirectFallback() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

type AuthEmailJob = {
  to: string;
  action: AuthEmailAction;
  token?: string;
  tokenHash?: string;
  newEmail?: string;
};

export function planAuthEmails(payload: SupabaseAuthEmailPayload): AuthEmailJob[] {
  const { user, email_data: emailData } = payload;
  const action = emailData.email_action_type;

  if (action === "email_change" && emailData.token_hash_new && user.new_email) {
    return [
      {
        to: user.email,
        action,
        token: emailData.token,
        tokenHash: emailData.token_hash_new,
      },
      {
        to: user.new_email,
        action,
        token: emailData.token_new,
        tokenHash: emailData.token_hash,
        newEmail: user.new_email,
      },
    ];
  }

  if (action === "email_change") {
    return [
      {
        to: user.new_email ?? user.email,
        action,
        token: emailData.token_new || emailData.token,
        tokenHash: emailData.token_hash || emailData.token_hash_new,
        newEmail: user.new_email,
      },
    ];
  }

  return [
    {
      to: user.email,
      action,
      token: emailData.token,
      tokenHash: emailData.token_hash,
    },
  ];
}

export async function sendSupabaseAuthEmails(payload: SupabaseAuthEmailPayload) {
  const jobs = planAuthEmails(payload);
  const results = [];

  for (const job of jobs) {
    const confirmationUrl =
      job.tokenHash && job.action !== "reauthentication"
        ? buildSupabaseConfirmationUrl(payload.email_data, job.tokenHash)
        : undefined;

    const result = await sendAuthEmail({
      to: job.to,
      action: job.action,
      confirmationUrl,
      token: job.token,
      newEmail: job.newEmail,
    });

    results.push(result);
    if (!result.ok && !result.skipped) {
      throw new Error(result.error ?? "Failed to send auth email");
    }
  }

  return results;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiGet, apiPost, getApiErrorMessage } from "@/lib/api";
import { libraryHome } from "@/lib/routes";
import { Logo } from "@/components/logo";

type InviteDetails = {
  token: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  role: "EDITOR" | "VIEWER";
  message: string | null;
  email: string;
  library: { id: string; name: string; icon: string };
  invitedBy: { name: string | null; email: string };
};

type Props = {
  token: string;
};

export function InviteView({ token }: Props) {
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<InviteDetails>(`/api/invites/${token}`);
        setInvite(data);
      } catch (e) {
        setError(getApiErrorMessage(e, "Invite not found"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  async function respond(action: "accept" | "decline") {
    setActing(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const result = await apiPost<{ libraryId?: string; status: string }>(
        `/api/invites/${token}`,
        { action }
      );
      if (action === "accept" && result.libraryId) {
        router.push(libraryHome(result.libraryId));
        router.refresh();
        return;
      }
      setInvite((prev) =>
        prev ? { ...prev, status: result.status as InviteDetails["status"] } : prev
      );
    } catch (e) {
      const message = getApiErrorMessage(e, "Failed to respond to invite");
      if (message === "Unauthorized") {
        setNeedsAuth(true);
      } else {
        setError(message);
      }
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
            <CardDescription>{error ?? "This invitation may have expired or been revoked."}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const inviter = invite.invitedBy.name || invite.invitedBy.email;
  const roleLabel = invite.role === "EDITOR" ? "Editor" : "Viewer";
  const loginHref = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="mb-8">
        <Logo />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Workspace invitation</CardTitle>
          <CardDescription>
            {inviter} invited you to join{" "}
            <span className="font-medium text-foreground">
              {invite.library.icon} {invite.library.name}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Role: <span className="text-foreground">{roleLabel}</span>
          </p>
          {invite.message && (
            <blockquote className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {invite.message}
            </blockquote>
          )}

          {invite.status === "PENDING" ? (
            <>
              {needsAuth && (
                <p className="text-sm text-muted-foreground">
                  Sign in as <span className="font-medium text-foreground">{invite.email}</span> to
                  respond.
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                {needsAuth ? (
                  <Link
                    href={loginHref}
                    className="inline-flex h-8 flex-1 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/80"
                  >
                    Sign in to accept
                  </Link>
                ) : (
                  <>
                    <Button
                      className="flex-1 gap-2"
                      disabled={acting}
                      onClick={() => respond("accept")}
                    >
                      {acting && <Loader2 className="size-4 animate-spin" />}
                      Accept invite
                    </Button>
                    <Button
                      variant="outline"
                      disabled={acting}
                      onClick={() => respond("decline")}
                    >
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This invite has already been {invite.status.toLowerCase()}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

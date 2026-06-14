"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, getApiErrorMessage } from "@/lib/client/api";
import { libraryHome } from "@/lib/client/routes";

type PendingInvite = {
  id: string;
  token: string;
  libraryId: string;
  libraryName: string;
  libraryIcon: string;
  role: "EDITOR" | "VIEWER";
  message: string | null;
  invitedBy: { name: string | null; email: string };
};

type Props = {
  onAccepted?: () => void;
};

export function PendingInvitesBanner({ onAccepted }: Props) {
  const router = useRouter();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<PendingInvite[]>("/api/invites");
      setInvites(data);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(invite: PendingInvite, action: "accept" | "decline") {
    setLoadingId(invite.id);
    setError(null);
    try {
      const result = await apiPost<{ libraryId?: string }>(`/api/invites/${invite.token}`, {
        action,
      });
      if (action === "accept" && result.libraryId) {
        onAccepted?.();
        router.push(libraryHome(result.libraryId));
        router.refresh();
        return;
      }
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to respond to invite"));
    } finally {
      setLoadingId(null);
    }
  }

  if (invites.length === 0) return null;

  const invite = invites[0];
  const inviter = invite.invitedBy.name || invite.invitedBy.email;
  const roleLabel = invite.role === "EDITOR" ? "Editor" : "Viewer";

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">
            {invite.libraryIcon} {inviter} invited you to{" "}
            <span className="font-semibold">{invite.libraryName}</span> as {roleLabel}
          </p>
          {invite.message && (
            <p className="text-sm text-muted-foreground">&ldquo;{invite.message}&rdquo;</p>
          )}
          {invites.length > 1 && (
            <p className="text-xs text-muted-foreground">
              +{invites.length - 1} more pending invite{invites.length - 1 === 1 ? "" : "s"}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            disabled={loadingId === invite.id}
            onClick={() => respond(invite, "accept")}
            className="gap-2"
          >
            {loadingId === invite.id && <Loader2 className="size-4 animate-spin" />}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loadingId === invite.id}
            onClick={() => respond(invite, "decline")}
          >
            Decline
          </Button>
          {invites.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => setInvites((prev) => prev.slice(1))}>
              <X className="size-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  getApiErrorMessage,
} from "@/lib/api";

type Member = {
  userId: string;
  email: string;
  name: string | null;
  role: "EDITOR" | "VIEWER";
};

type PendingInvite = {
  id: string;
  email: string;
  role: "EDITOR" | "VIEWER";
  message: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  libraryId: string;
  libraryName: string;
  onOpenChange: (open: boolean) => void;
};

export function ShareLibraryModal({ open, libraryId, libraryName, onOpenChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [owner, setOwner] = useState<{ email: string; name: string | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{
        owner: { email: string; name: string | null } | null;
        members?: Member[];
        pendingInvites?: PendingInvite[];
      }>(`/api/libraries/${libraryId}/members`);
      setOwner(data.owner);
      setMembers(data.members ?? []);
      setPendingInvites(data.pendingInvites ?? []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load members"));
    } finally {
      setLoading(false);
    }
  }, [libraryId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      await apiPost(`/api/libraries/${libraryId}/members`, {
        email: email.trim(),
        role,
        message: message.trim() || undefined,
      });
      setEmail("");
      setMessage("");
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to invite"));
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    await apiDelete(`/api/libraries/${libraryId}/members/${userId}`);
    await load();
  }

  async function cancelInvite(inviteId: string) {
    await apiDelete(`/api/libraries/${libraryId}/invites/${inviteId}`);
    await load();
  }

  async function updateRole(userId: string, nextRole: "EDITOR" | "VIEWER") {
    await apiPatch(`/api/libraries/${libraryId}/members/${userId}`, { role: nextRole });
    await load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share workspace</DialogTitle>
          <DialogDescription>
            Invite people to <span className="font-medium text-foreground">{libraryName}</span>.
            They&apos;ll get an email and must accept before joining.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <form onSubmit={invite} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="share-email">Email</Label>
                <Input
                  id="share-email"
                  type="email"
                  placeholder="collaborator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "EDITOR" | "VIEWER")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EDITOR">Editor — can add and edit</SelectItem>
                    <SelectItem value="VIEWER">Viewer — read only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="share-message">Message (optional)</Label>
                <textarea
                  id="share-message"
                  rows={3}
                  placeholder="Add a personal note to the invite email…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={inviting || !email.trim()} className="gap-2">
                {inviting && <Loader2 className="size-4 animate-spin" />}
                {inviting ? "Sending invite…" : "Send invite"}
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">People</p>
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {owner && (
                  <li className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{owner.name || owner.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{owner.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">Owner</span>
                  </li>
                )}
                {members.map((member) => (
                  <li key={member.userId} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.name || member.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Select
                      value={member.role}
                      onValueChange={(v) => updateRole(member.userId, v as "EDITOR" | "VIEWER")}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EDITOR">Editor</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeMember(member.userId)}
                      aria-label={`Remove ${member.email}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{invite.email}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Invite pending · {invite.role === "EDITOR" ? "Editor" : "Viewer"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => cancelInvite(invite.id)}
                      aria-label={`Cancel invite for ${invite.email}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

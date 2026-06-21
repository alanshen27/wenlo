"use client";

import { useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shareRoute } from "@/lib/client/routes";
import { apiPost } from "@/lib/client/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "page" | "document";
  id: string;
  title: string;
};

export function ShareItemModal({ open, onOpenChange, type, id, title }: Props) {
  const [access, setAccess] = useState<"NONE" | "VIEW" | "EDIT">("VIEW");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const result = await apiPost<{ shareToken: string | null }>("/api/share", {
        type,
        id,
        access,
        password: password.trim() || null,
      });
      setToken(result.shareToken);
    } finally {
      setSaving(false);
    }
  }

  const shareUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}${shareRoute(token)}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{title}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-access">Access</Label>
            <select
              id="share-access"
              value={access}
              onChange={(e) => setAccess(e.target.value as typeof access)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="NONE">No public link</option>
              <option value="VIEW">Anyone with link can view</option>
              <option value="EDIT">Anyone with link can edit</option>
            </select>
          </div>
          {access !== "NONE" && (
            <div className="space-y-2">
              <Label htmlFor="share-password">Password (optional)</Label>
              <Input
                id="share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty for no password"
              />
            </div>
          )}
          {shareUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <code className="min-w-0 flex-1 truncate text-xs">{shareUrl}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          )}
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Update link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

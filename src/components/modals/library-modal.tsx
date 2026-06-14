"use client";

import { useEffect, useState } from "react";
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
import { IconPicker } from "@/components/modals/icon-picker";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialName?: string;
  initialIcon?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; icon: string }) => void | Promise<void>;
};

export function LibraryModal({
  open,
  mode,
  initialName = "",
  initialIcon = "📚",
  onOpenChange,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setIcon(initialIcon);
    }
  }, [open, initialName, initialIcon]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), icon });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "New library" : "Edit library"}</DialogTitle>
            <DialogDescription>
              Libraries are separate spaces for your files and notes — work, research, personal, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="library-name">Name</Label>
              <Input
                id="library-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Library"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Icon</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {mode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

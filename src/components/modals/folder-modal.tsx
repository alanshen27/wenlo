"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { ColorPicker } from "@/components/modals/color-picker";
import type { FolderColorId } from "@/lib/folder-colors";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initialName?: string;
  initialColor?: FolderColorId;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; color: FolderColorId }) => void | Promise<void>;
};

export function FolderModal({
  open,
  mode,
  initialName = "",
  initialColor = "gray",
  onOpenChange,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<FolderColorId>(initialColor);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor(initialColor);
    }
  }, [open, initialName, initialColor]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), color });
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
            <DialogTitle>{mode === "create" ? "New folder" : "Edit folder"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Create a folder to organize pages and files."
                : "Update the folder name or color."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Folder name"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading} className="gap-2">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading
                ? mode === "create"
                  ? "Creating…"
                  : "Saving…"
                : mode === "create"
                  ? "Create"
                  : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

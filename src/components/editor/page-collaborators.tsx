"use client";

import type { PageCollaborator } from "@/lib/realtime/page-presence";
import { cn } from "@/lib/core/utils";

function initials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function label(collaborator: PageCollaborator) {
  return collaborator.name?.trim() || collaborator.email;
}

type Props = {
  collaborators: PageCollaborator[];
  className?: string;
};

export function PageCollaborators({ collaborators, className }: Props) {
  if (collaborators.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="hidden text-xs text-muted-foreground sm:inline">Editing</span>
      <div className="flex -space-x-2">
        {collaborators.slice(0, 4).map((collaborator) => (
          <span
            key={collaborator.userId}
            title={label(collaborator)}
            className="inline-flex size-6 items-center justify-center rounded-full border border-background bg-primary/20 text-[10px] font-medium text-primary"
          >
            {initials(collaborator.name, collaborator.email)}
          </span>
        ))}
      </div>
      {collaborators.length > 4 && (
        <span className="text-xs text-muted-foreground">+{collaborators.length - 4}</span>
      )}
    </div>
  );
}

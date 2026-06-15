"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/blocknote-ui/avatar";
import { cn } from "@/lib/core/utils";

export type CollaboratorLike = {
  userId?: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

function initials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function label(person: CollaboratorLike): string {
  return person.name?.trim() || person.email;
}

/** Stacked "shared with" avatars used on native + cloud cards. */
export function CollaboratorAvatars({
  people,
  max = 3,
  size = "sm",
  className,
}: {
  people: CollaboratorLike[];
  max?: number;
  size?: "sm" | "xs";
  className?: string;
}) {
  if (people.length === 0) return null;

  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const dim = size === "xs" ? "size-5" : "size-6";
  const text = size === "xs" ? "text-[8px]" : "text-[10px]";

  return (
    <div className={cn("flex items-center", className)} title={people.map(label).join(", ")}>
      <div className="flex -space-x-1.5">
        {shown.map((person) => (
          <Avatar
            key={person.userId ?? person.email}
            className={cn(dim, "border border-background")}
          >
            {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
            <AvatarFallback className={cn(text, "bg-primary/15 font-medium text-primary")}>
              {initials(person.name, person.email)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {overflow > 0 && (
        <span className="ml-1 text-[10px] font-medium text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/blocknote-ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { libraryHome, readStoredLibraryId, settingsIntegrationsRoute, settingsPlanRoute } from "@/lib/client/routes";
import { apiGet, apiPatch, getApiErrorMessage } from "@/lib/client/api";
import { ThemeSettingRow, ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/core/utils";

type MeResponse = {
  email: string;
  name: string | null;
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

export function AccountSettingsView() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const data = await apiGet<MeResponse>("/api/me");
      setMe(data);
      setName(data.name ?? "");
      setAvatarUrl(data.avatarUrl ?? "");
    } catch {
      router.push("/login");
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!me || saving) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const data = await apiPatch<MeResponse>("/api/me", { name, avatarUrl });
      setMe({ email: data.email, name: data.name, avatarUrl: data.avatarUrl });
      setAvatarUrl(data.avatarUrl ?? "");
      setSaved(true);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  const backHref = (() => {
    const libraryId = readStoredLibraryId();
    return libraryId ? libraryHome(libraryId) : "/";
  })();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 md:px-10">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-6 py-10 md:px-10">
        <div className="mx-auto max-w-lg space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your profile and preferences.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-border bg-card p-5">
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Profile picture</Label>
              <div className="flex items-center gap-3">
                <Avatar className="size-12 shrink-0">
                  {avatarUrl.trim() && <AvatarImage src={avatarUrl.trim()} alt="" />}
                  <AvatarFallback className="text-sm font-medium">
                    {initials(name || null, me.email)}
                  </AvatarFallback>
                </Avatar>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="https://…/avatar.png"
                  inputMode="url"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Paste an image URL (e.g. a Supabase Storage public link).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={me.email} disabled className="opacity-70" />
              <p className="text-xs text-muted-foreground">
                Email is managed through your sign-in provider.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium">Appearance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose light, dark, or match your system setting.
            </p>
            <div className="mt-4">
              <ThemeSettingRow />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium">CLI & API access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create wenlo API keys so scripts and agents can read and write your libraries.
            </p>
            <Link
              href={settingsIntegrationsRoute()}
              className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}
            >
              Manage API keys
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium">Plan & billing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upgrade for more AI tokens or manage your subscription.
            </p>
            <Link
              href={settingsPlanRoute()}
              className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-flex")}
            >
              Open plan settings
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

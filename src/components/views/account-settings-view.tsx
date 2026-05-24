"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { libraryHome, readStoredLibraryId, settingsIntegrationsRoute, settingsPlanRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

type MeResponse = {
  email: string;
  name: string | null;
};

export function AccountSettingsView() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (!res.ok) {
      router.push("/login");
      return;
    }
    const data = (await res.json()) as MeResponse;
    setMe(data);
    setName(data.name ?? "");
    setLoading(false);
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
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setMe({ email: data.email, name: data.name });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
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
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
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
            <h2 className="text-sm font-medium">CLI & API access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create Recall API keys so scripts and agents can read and write your libraries.
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

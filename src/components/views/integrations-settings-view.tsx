"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { libraryHome, readStoredLibraryId } from "@/lib/routes";

type Library = { id: string; name: string; icon: string };

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  libraryId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  library: Library | null;
};

export function IntegrationsSettingsView() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyLibraryId, setNewKeyLibraryId] = useState<string>("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [libsRes, keysRes] = await Promise.all([
      fetch("/api/libraries"),
      fetch("/api/api-keys"),
    ]);

    if (libsRes.ok) setLibraries(await libsRes.json());
    if (keysRes.ok) {
      const data = await keysRes.json();
      setKeys(data.keys ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setError(null);
    setCreatedKey(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          libraryId: newKeyLibraryId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create key");
      setCreatedKey(data.key);
      setNewKeyName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create API key");
    } finally {
      setCreatingKey(false);
    }
  }

  async function revokeKey(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    await load();
  }

  const backHref = (() => {
    const libraryId = readStoredLibraryId();
    return libraryId ? libraryHome(libraryId) : "/";
  })();

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading API settings…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 md:px-10">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </header>

      <main className="px-6 py-10 md:px-10">
        <div className="mx-auto max-w-2xl space-y-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">CLI & API access</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create Recall API keys for scripts, CLIs, and AI agents to read and write your libraries.
              These keys authenticate to Recall — not OpenAI.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div>
              <h2 className="text-sm font-medium">API keys</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pass as{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer rcsk_…</code>{" "}
                on gateway requests. Scope a key to one library or grant access to all.
              </p>
            </div>

            {createdKey && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-300">Copy your new key now</p>
                <code className="mt-2 block break-all rounded bg-background/80 p-2 font-mono text-xs">
                  {createdKey}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() => navigator.clipboard.writeText(createdKey)}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </div>
            )}

            <form onSubmit={createKey} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key name</Label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My CLI"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-library">Library scope</Label>
                <select
                  id="key-library"
                  value={newKeyLibraryId}
                  onChange={(e) => setNewKeyLibraryId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="">All libraries</option>
                  {libraries.map((lib) => (
                    <option key={lib.id} value={lib.id}>
                      {lib.icon} {lib.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={creatingKey || !newKeyName.trim()} className="gap-1.5">
                  <Plus className="size-4" />
                  Create key
                </Button>
              </div>
            </form>

            {keys.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {keys.map((key) => (
                  <li key={key.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{key.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {key.keyPrefix}…
                        {key.library ? ` · ${key.library.icon} ${key.library.name}` : " · all libraries"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => revokeKey(key.id)}
                      aria-label={`Revoke ${key.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-medium">Gateway endpoints</h2>
            <p className="text-sm text-muted-foreground">
              Export first to discover folder IDs, then pass{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">folderId</code> on ingest or
              query. Omit it (or use <code className="rounded bg-muted px-1 py-0.5 text-xs">"root"</code>
              ) to place items at the library root.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
{`# 1. Export — folders[] has { id, name, parentId }
curl "${baseUrl}/api/gateway/v1/libraries/{libraryId}/export?type=all" \\
  -H "Authorization: Bearer rcsk_…"

# 2. Ingest into a folder (pages & documents accept folderId)
curl -X POST ${baseUrl}/api/gateway/v1/libraries/{libraryId}/ingest \\
  -H "Authorization: Bearer rcsk_…" \\
  -H "Content-Type: application/json" \\
  -d '{"kind":"page","title":"Meeting notes","content":"…","folderId":"{folderId}"}'

# 3. Export or search within one folder
curl "${baseUrl}/api/gateway/v1/libraries/{libraryId}/export?folderId={folderId}" \\
  -H "Authorization: Bearer rcsk_…"

curl -X POST ${baseUrl}/api/gateway/v1/libraries/{libraryId}/query \\
  -H "Authorization: Bearer rcsk_…" \\
  -H "Content-Type: application/json" \\
  -d '{"q":"transformer attention","folderId":"{folderId}","limit":10}'`}
            </pre>
          </section>
        </div>
      </main>
    </div>
  );
}

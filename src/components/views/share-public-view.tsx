"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiPost } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SharePayload = {
  type: "page" | "document";
  id: string;
  title: string;
  content?: unknown;
  documentType?: string;
  access: string;
};

export function SharePublicView() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(pw?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiPost<SharePayload>("/api/share/access", {
        token,
        password: pw,
      });
      setData(result);
      setNeedsPassword(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      if (msg.toLowerCase().includes("password")) {
        setNeedsPassword(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  if (loading && !needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading shared content…
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void load(password);
          }}
        >
          <h1 className="text-lg font-semibold">Password required</h1>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Unlock
          </Button>
        </form>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-destructive">
        {error ?? "Link not found"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-xs text-muted-foreground">Shared {data.type}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        {data.type === "page" && typeof data.content === "object" && (
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs">
            {JSON.stringify(data.content, null, 2)}
          </pre>
        )}
        {data.type === "document" && (
          <p className="text-sm text-muted-foreground">
            Open in wenlo to view {data.documentType ?? "document"} content.
          </p>
        )}
      </div>
    </div>
  );
}

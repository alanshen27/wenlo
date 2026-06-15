"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  FolderTree,
  Loader2,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch, apiPost, getApiErrorMessage } from "@/lib/client/api";
import { libraryHome } from "@/lib/client/routes";
import {
  ONBOARDING_PAGE,
  ONBOARDING_RECALL_PROMPT,
} from "@/lib/onboarding/onboarding-content";
import { cn } from "@/lib/core/utils";

type Library = { id: string; name: string; icon: string };

type AgentStreamEvent =
  | { type: "meta" }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; error: string };

const STEPS = [
  { id: "library", label: "Library", icon: FolderTree },
  { id: "store", label: "Store", icon: Upload },
  { id: "recall", label: "Recall", icon: Sparkles },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function OnboardingView() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>("library");
  const [library, setLibrary] = useState<Library | null>(null);
  const [libraryName, setLibraryName] = useState("");
  const [savingLibrary, setSavingLibrary] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [pageCreated, setPageCreated] = useState(false);
  const [question, setQuestion] = useState(ONBOARDING_RECALL_PROMPT);
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const libraries = await apiGet<Library[]>("/api/libraries");
        const first = libraries[0];
        if (!cancelled && first) {
          setLibrary(first);
          setLibraryName(first.name);
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveLibrary = useCallback(async () => {
    if (!library) return;
    setSavingLibrary(true);
    setError(null);
    try {
      const trimmed = libraryName.trim();
      if (trimmed && trimmed !== library.name) {
        const updated = await apiPatch<Library>(`/api/libraries/${library.id}`, {
          name: trimmed,
        });
        setLibrary(updated);
        setLibraryName(updated.name);
      }
      setStep("store");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSavingLibrary(false);
    }
  }, [library, libraryName]);

  const createWelcomePage = useCallback(async () => {
    if (!library) return;
    setCreatingPage(true);
    setError(null);
    try {
      await apiPost("/api/pages", {
        libraryId: library.id,
        title: ONBOARDING_PAGE.title,
        content: ONBOARDING_PAGE.content,
      });
      setPageCreated(true);
      setStep("recall");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setCreatingPage(false);
    }
  }, [library]);

  const askRecall = useCallback(async () => {
    if (!library || !question.trim()) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          libraryId: library.id,
          scope: "all",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Recall failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AgentStreamEvent;
          if (event.type === "delta") {
            text += event.text;
            setAnswer(text);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setAsking(false);
    }
  }, [library, question]);

  const finish = useCallback(async () => {
    setFinishing(true);
    setError(null);
    try {
      await apiPatch("/api/me", { completeOnboarding: true });
      if (library) {
        router.push(libraryHome(library.id));
        router.refresh();
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setFinishing(false);
    }
  }, [library, router]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo size="sm" />
        <p className="text-sm text-muted-foreground">First-time setup</p>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
        <ol className="mb-10 flex items-center justify-center gap-2">
          {STEPS.map((item, i) => {
            const Icon = item.icon;
            const done = i < stepIndex;
            const active = item.id === step;
            return (
              <li key={item.id} className="flex items-center gap-2">
                {i > 0 && (
                  <span
                    className={cn(
                      "h-px w-8",
                      done ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    active && "border-primary bg-primary/10 text-primary",
                    done && !active && "border-primary/40 text-primary",
                    !active && !done && "border-border text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3" /> : <Icon className="size-3" />}
                  {item.label}
                </span>
              </li>
            );
          })}
        </ol>

        {error && (
          <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {step === "library" && (
          <section className="flex flex-1 flex-col">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your library is home
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Everything lives in a library — files, notes, and slides. Recall
              searches across all of it. Name yours to get started.
            </p>

            <div className="mt-8 space-y-2">
              <Label htmlFor="library-name">Library name</Label>
              <Input
                id="library-name"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="My Library"
                disabled={!library || savingLibrary}
              />
            </div>

            <div className="mt-auto flex justify-end pt-10">
              <Button
                onClick={() => void saveLibrary()}
                disabled={!library || !libraryName.trim() || savingLibrary}
              >
                {savingLibrary ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </section>
        )}

        {step === "store" && (
          <section className="flex flex-1 flex-col">
            <h1 className="text-2xl font-semibold tracking-tight">
              Add your first note
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              wenlo indexes every page and file you add. We&apos;ll create a short
              welcome note so Recall has something to search.
            </p>

            <div className="mt-8 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">{ONBOARDING_PAGE.title}</p>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {ONBOARDING_PAGE.plainText}
              </p>
            </div>

            <div className="mt-auto flex justify-end gap-2 pt-10">
              <Button
                variant="outline"
                onClick={() => setStep("recall")}
                disabled={creatingPage}
              >
                Skip
              </Button>
              <Button onClick={() => void createWelcomePage()} disabled={creatingPage}>
                {creatingPage ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create note
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </section>
        )}

        {step === "recall" && (
          <section className="flex flex-1 flex-col">
            <h1 className="text-2xl font-semibold tracking-tight">
              Meet Recall
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Ask a question across your library. Recall reads your notes and
              files, then answers with sources.
            </p>

            {pageCreated && (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" />
                Welcome note indexed — try asking about it.
              </p>
            )}

            <div className="mt-6 space-y-2">
              <Label htmlFor="recall-question">Your question</Label>
              <textarea
                id="recall-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <Button
              variant="outline"
              className="mt-3 w-fit"
              onClick={() => void askRecall()}
              disabled={asking || !question.trim()}
            >
              {asking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Ask Recall
                </>
              )}
            </Button>

            {answer && (
              <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  Recall
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
              </div>
            )}

            <div className="mt-auto flex justify-end pt-10">
              <Button onClick={() => void finish()} disabled={finishing}>
                {finishing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Opening library…
                  </>
                ) : (
                  <>
                    Go to library
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

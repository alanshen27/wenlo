import Link from "next/link";
import {
  ArrowRight,
  Brain,
  FolderTree,
  Search,
  Sparkles,
  Terminal,
  Upload,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PLAN_LIST } from "@/lib/plans";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: FolderTree,
    title: "Nested libraries & folders",
    description:
      "Organize notes, PDFs, slides, and code snippets the way you think — multiple libraries, colored folders, drag-and-drop.",
  },
  {
    icon: Upload,
    title: "Upload anything",
    description:
      "Drop PDFs, DOCX, markdown, and source files. Text is extracted and indexed automatically.",
  },
  {
    icon: Search,
    title: "Grep + semantic search",
    description:
      "Keyword search with pg_trgm, plus vector embeddings when you need meaning, not just exact matches.",
  },
  {
    icon: Sparkles,
    title: "Recall agent",
    description:
      "Ask questions scoped to a folder or your whole library. Answers cite the pages and documents they came from.",
  },
  {
    icon: Brain,
    title: "Rich pages",
    description:
      "BlockNote editor with code blocks, Mermaid diagrams, and image uploads — Notion-style, developer-friendly.",
  },
  {
    icon: Terminal,
    title: "CLI & API gateway",
    description:
      "Ingest, export, and query libraries programmatically with API keys. Built for scripts and agents.",
  },
];

export function LandingView() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          <span className="text-primary">recall</span>
          <span className="text-muted-foreground">.sh</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Sign in
          </Link>
          <Link href="/login?mode=signup" className={cn(buttonVariants({ size: "sm" }))}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:px-10 md:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <Sparkles className="size-3 text-primary" />
              Personal coding knowledge base
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Remember everything you&apos;ve read, written, and shipped
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-pretty md:text-xl">
              Obsidian-style pages, grep-fast search, and an AI agent — for your notes, PDFs,
              lecture slides, and code. Query it from the web or your terminal.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/login?mode=signup" className={cn(buttonVariants({ size: "lg" }), "gap-2 px-5")}>
                Start for free
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#features"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-5")}
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-2xl">
            <div className="overflow-hidden rounded-xl border border-border bg-card/80 shadow-2xl shadow-primary/5 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="size-2.5 rounded-full bg-red-500/80" />
                <span className="size-2.5 rounded-full bg-yellow-500/80" />
                <span className="size-2.5 rounded-full bg-green-500/80" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">~/projects/ml-notes</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
                <code>
                  <span className="text-muted-foreground">$ </span>
                  <span className="text-primary">recall</span>
                  <span className="text-foreground"> &quot;how does rotary positional encoding work?&quot;</span>
                  {"\n\n"}
                  <span className="text-emerald-400/90">→</span>
                  <span className="text-muted-foreground"> 3 matches in </span>
                  <span className="text-foreground">transformers/</span>
                  {"\n\n"}
                  <span className="text-foreground/90">  [page] Attention Is All You Need — notes</span>
                  {"\n"}
                  <span className="text-muted-foreground">         …sin/cos functions of different frequencies…</span>
                  {"\n\n"}
                  <span className="text-foreground/90">  [pdf]  CS224N Lecture 5 — slides</span>
                  {"\n"}
                  <span className="text-muted-foreground">         …relative positions via rotation in complex space…</span>
                  {"\n\n"}
                  <span className="text-muted-foreground">$ </span>
                  <span className="text-primary">recall</span>
                  <span className="text-foreground"> --agent &quot;explain it like I&apos;m implementing it&quot;</span>
                  {"\n\n"}
                  <span className="text-emerald-400/90">→</span>
                  <span className="text-muted-foreground"> Rotary PE encodes position by rotating query/key vectors…</span>
                </code>
              </pre>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border bg-card/30 py-20">
          <div className="mx-auto max-w-6xl px-6 md:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Built for how you actually learn</h2>
              <p className="mt-3 text-muted-foreground">
                Collect knowledge once. Search it instantly. Ask questions when grep isn&apos;t enough.
              </p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm transition-colors hover:border-primary/30"
                >
                  <div className="mb-3 inline-flex rounded-lg border border-border bg-background/80 p-2">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6 md:px-10">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Simple pricing</h2>
              <p className="mt-3 text-muted-foreground">
                Free to start. Upgrade when you need more AI tokens.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
              {PLAN_LIST.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-xl border p-6",
                    plan.id === "PRO"
                      ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5"
                      : "border-border bg-card/60"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-medium">{plan.name}</h3>
                    <p className="text-2xl font-semibold tracking-tight">
                      {plan.priceLabel}
                      {plan.id === "PRO" && (
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      )}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-5 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border py-20">
          <div className="mx-auto max-w-6xl px-6 text-center md:px-10">
            <h2 className="text-3xl font-semibold tracking-tight">Your second brain, queryable</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Sign up in seconds. Create a library, upload your first PDF, and ask your first question.
            </p>
            <Link
              href="/login?mode=signup"
              className={cn(buttonVariants({ size: "lg" }), "mt-8 gap-2 px-5")}
            >
              Create your library
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row md:px-10">
          <p>
            <span className="text-foreground">recall</span>.sh — MIT License
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

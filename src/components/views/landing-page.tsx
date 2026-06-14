import Link from "next/link";
import {
  ArrowRight,
  Brain,
  FileText,
  FolderClosed,
  FolderTree,
  House,
  Search,
  Sparkles,
  Terminal,
  Upload,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { PLAN_LIST } from "@/lib/billing/plans";
import { cn } from "@/lib/core/utils";

const features = [
  {
    icon: FolderTree,
    title: "Cloud storage",
    description:
      "Store any file — PDFs, images, docs, slides, code, audio, video — in libraries and folders.",
  },
  {
    icon: Brain,
    title: "Notes & rich pages",
    description: "Write alongside your files with a block editor — code, diagrams, and images.",
  },
  {
    icon: Upload,
    title: "Indexed for agents",
    description: "Every upload is extracted, OCR'd, and embedded — instantly answerable.",
  },
  {
    icon: Search,
    title: "Grep + semantic search",
    description: "Exact matches when you want them. Meaning when you need it.",
  },
  {
    icon: Sparkles,
    title: "Recall agent",
    description: "Ask across a folder or your whole library — the agent reads your files and cites sources.",
  },
  {
    icon: Terminal,
    title: "CLI & API",
    description: "Pipe files in, query from scripts, and wire wenlo into your own agents.",
  },
];

const steps = [
  { label: "Store", detail: "Upload files and write notes — one home for everything." },
  { label: "Index", detail: "wenlo extracts, OCRs, and embeds it all automatically." },
  { label: "Recall", detail: "Your agent searches, reads, and answers with sources." },
];

type LandingPageProps = {
  isLoggedIn?: boolean;
  libraryHref?: string | null;
};

export function LandingPage({ isLoggedIn = false, libraryHref }: LandingPageProps) {
  const appHref = libraryHref ?? "/login?mode=signup";
  const primaryCta = isLoggedIn ? "Open your library" : "Start for free";
  const primaryHref = isLoggedIn ? appHref : "/login?mode=signup";

  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-orb landing-orb-1 absolute -top-24 left-[8%] size-[28rem] rounded-full bg-primary/20 blur-3xl dark:bg-primary/15" />
        <div className="landing-orb landing-orb-2 absolute top-[18%] -right-20 size-[22rem] rounded-full bg-rose-400/20 blur-3xl dark:bg-rose-500/10" />
        <div className="landing-orb landing-orb-3 absolute bottom-[30%] left-[5%] size-[18rem] rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
        <div className="landing-orb landing-orb-4 absolute -bottom-16 right-[12%] size-[24rem] rounded-full bg-amber-400/15 blur-3xl dark:bg-amber-500/10" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)] dark:bg-[linear-gradient(to_right,oklch(1_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.04)_1px,transparent_1px)]"
      />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5 md:px-8">
        <Logo size="sm" />
        <nav className="flex items-center gap-1">
          <ThemeToggle />
          {!isLoggedIn && (
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Sign in
            </Link>
          )}
          <Link href={primaryHref} className={cn(buttonVariants({ size: "sm" }))}>
            {isLoggedIn ? "Open library" : "Get started"}
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-8 md:px-8 md:pt-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <Sparkles className="size-3 text-primary" />
              Cloud storage + notes for the agentic era
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Storage your agent can actually think with
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-pretty md:text-xl">
              Keep your files and notes in one place — then let an agent search, read, and answer
              across all of it. wenlo turns everything you store into context.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={primaryHref} className={cn(buttonVariants({ size: "lg" }), "gap-2 px-5")}>
                {primaryCta}
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

          <div className="group mx-auto mt-12 max-w-3xl md:mt-16">
            <div className="opacity-90 transition-all duration-500 mask-[linear-gradient(to_bottom,black_70%,transparent)] group-hover:blur-0 group-hover:opacity-100">
              <AppMockup />
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/20 py-14 md:py-16">
          <div className="mx-auto max-w-5xl px-6 md:px-8">
            <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
              {steps.map(({ label, detail }, index) => (
                <li key={label} className="text-center sm:text-left">
                  <p className="text-xs font-medium text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-1 text-lg font-medium tracking-tight">{label}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-6 md:px-8">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">
                Built for you and your agents
              </h2>
              <p className="mt-3 text-muted-foreground">
                Store once. Search instantly. Let an agent do the reading.
              </p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
                >
                  <div className="mb-3 inline-flex rounded-lg border border-border bg-background p-2">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/20 py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-6 md:px-8">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">
                Simple pricing
              </h2>
              <p className="mt-3 text-muted-foreground">
                Free to start. Upgrade when you need more storage and agent usage.
              </p>
            </div>
            <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
              {PLAN_LIST.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-xl border p-5",
                    plan.id === "PRO"
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/80 bg-card/50"
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
                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
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

        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-6 text-center md:px-8">
            <h2 className="text-3xl font-semibold tracking-tight">
              Storage your agent can think with
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              {isLoggedIn
                ? "Pick up where you left off — your library is waiting."
                : "Sign up in seconds. Upload your first file. Let your agent take it from there."}
            </p>
            <Link
              href={primaryHref}
              className={cn(buttonVariants({ size: "lg" }), "mt-8 gap-2 px-5")}
            >
              {isLoggedIn ? "Open your library" : "Create your library"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row md:px-8">
          <p>
            <span className="text-foreground">wenlo</span> · recalls.sh — MIT License
          </p>
          {!isLoggedIn && (
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}

const mockFolders = [
  { name: "Transformers", color: "bg-blue-500" },
  { name: "Datasets", color: "bg-emerald-500" },
  { name: "Papers", color: "bg-amber-500" },
];

const mockSources = [
  {
    icon: FileText,
    title: "Attention Is All You Need — notes",
    snippet: "…RoPE rotates query/key vectors by an angle proportional to position, so dot products encode relative distance…",
    badge: "keyword + semantic",
  },
  {
    icon: FileText,
    title: "CS224N Lecture 5 — slides.pdf",
    snippet: "…unlike absolute embeddings, rotary encodings extrapolate to longer sequences than seen in training…",
    badge: "semantic",
  },
];

function AppMockup() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl shadow-primary/10 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border/80 bg-muted/40 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-500/80" />
        <span className="size-2.5 rounded-full bg-yellow-500/80" />
        <span className="size-2.5 rounded-full bg-green-500/80" />
        <div className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">ML Research</span>
          <span className="opacity-50">/</span>
          <span className="inline-flex items-center gap-1 text-primary">
            <Sparkles className="size-3" />
            Recall
          </span>
        </div>
      </div>

      <div className="flex min-h-104">
        <aside className="hidden w-52 shrink-0 flex-col gap-4 border-r border-border/80 bg-muted/20 p-3 sm:flex">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-1.5">
            <span className="grid size-5 place-items-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">
              M
            </span>
            <span className="truncate text-sm font-medium">ML Research</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <MockNavItem icon={House} label="Home" />
            <MockNavItem icon={Search} label="Search" />
            <MockNavItem icon={Sparkles} label="Recall" active />
          </div>

          <div className="flex flex-col gap-1">
            <p className="px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Folders
            </p>
            {mockFolders.map((folder) => (
              <div
                key={folder.name}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
              >
                <FolderClosed className={cn("size-4 fill-current", folderTint(folder.color))} />
                <span className="truncate">{folder.name}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border/80 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-2 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              ML Research · All
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-hidden p-4">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                How does rotary positional encoding work?
              </div>
            </div>

            <div className="space-y-3">
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed text-foreground/90">
                Rotary positional encoding (RoPE) rotates the query and key vectors by an angle that grows
                with token position. Because attention scores depend on the angle{" "}
                <span className="text-muted-foreground">difference</span>, the model directly sees{" "}
                <span className="font-medium text-foreground">relative</span> positions and generalizes to
                longer sequences.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">2 sources</p>
                {mockSources.map((source) => (
                  <div
                    key={source.title}
                    className="rounded-lg border border-border bg-card p-2.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                        <source.icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{source.title}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {source.badge}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{source.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border/80 p-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <span className="truncate text-sm text-muted-foreground">Ask anything about your notes…</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                <Sparkles className="size-3" />
                Recall
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockNavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof House;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </div>
  );
}

function folderTint(color: string) {
  return color.replace("bg-", "text-");
}

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  ChevronDown,
  FolderTree,
  House,
  Plug,
  Search,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { LibraryIcon } from "@/components/icons/library-icon";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FolderArtwork } from "@/lib/client/file-icons";
import { PLAN_LIST } from "@/lib/billing/plans";
import { cn } from "@/lib/core/utils";

const features = [
  {
    icon: FolderTree,
    title: "Centralized storage",
    description:
      "Organize PDFs, slides, docs, and media in libraries and folders — one source of truth for your team.",
  },
  {
    icon: Brain,
    title: "Notes & rich pages",
    description:
      "Capture context alongside files with a block editor for text, code, diagrams, and embeds.",
  },
  {
    icon: Upload,
    title: "Automatic indexing",
    description:
      "Uploads are extracted, OCR'd, and embedded so content is searchable and ready for agents.",
  },
  {
    icon: Search,
    title: "Keyword + semantic search",
    description: "Find exact phrases or related concepts across your entire library in seconds.",
  },
  {
    icon: Sparkles,
    title: "Recall agent",
    description:
      "Ask questions across a folder or library — answers are grounded in your files with citations.",
  },
  {
    icon: Plug,
    title: "API & integrations",
    description:
      "Ingest files, query your library, and connect external agents via API keys and MCP.",
  },
];

const steps = [
  { label: "Store", detail: "Upload files and write notes in a shared workspace." },
  { label: "Index", detail: "wenlo extracts, OCRs, and embeds content automatically." },
  { label: "Recall", detail: "Search, read, and answer with cited sources." },
] as const;

const featureCardClass =
  "rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 hover:shadow-md";

const featureLayoutClass: Record<string, string> = {
  "Recall agent": "sm:col-span-2 lg:col-span-4",
  "API & integrations": "lg:col-span-2",
};

type LandingPageProps = {
  isLoggedIn?: boolean;
  libraryHref?: string | null;
};

export function LandingPage({ isLoggedIn = false, libraryHref }: LandingPageProps) {
  const appHref = libraryHref ?? "/login?mode=signup";
  const primaryCta = isLoggedIn ? "Open your library" : "Start for free";
  const primaryHref = isLoggedIn ? appHref : "/login?mode=signup";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.03)_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)] dark:bg-[linear-gradient(to_right,oklch(1_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.04)_1px,transparent_1px)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-0 size-144 rounded-full bg-primary/12 blur-3xl dark:bg-primary/8"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[40%] -left-24 size-80 rounded-full bg-primary/6 blur-3xl"
      />

      <header className="relative z-10 border-b border-border/80 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-8">
          <Logo size="sm" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="#features"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden text-muted-foreground sm:inline-flex"
              )}
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden text-muted-foreground sm:inline-flex"
              )}
            >
              Pricing
            </Link>
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
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:px-8 md:pt-16 lg:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10">
            <div className="text-center lg:text-left">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3" />
                File storage &amp; AI retrieval
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
                Turn your files into{" "}
                <span className="text-primary">answers your team can trust</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground text-pretty md:text-xl">
                wenlo brings documents, notes, and search into one workspace — then grounds AI
                answers in your own content with citations.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
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
              <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-8 text-left">
                {[
                  { value: "Any file", label: "PDFs, slides, code & more" },
                  { value: "Instant", label: "OCR + embeddings on upload" },
                  { value: "Cited", label: "Every answer links to sources" },
                ].map((stat) => (
                  <div key={stat.value}>
                    <dt className="text-sm font-semibold tracking-tight">{stat.value}</dt>
                    <dd className="mt-0.5 text-xs leading-snug text-muted-foreground">{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
              <div
                aria-hidden
                className="absolute -inset-4 rounded-3xl bg-linear-to-br from-primary/15 via-transparent to-primary/5 blur-2xl"
              />
              <div className="relative">
                <AppMockup />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/40 py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <ol className="grid gap-6 sm:grid-cols-3">
              {steps.map(({ label, detail }, index) => (
                <li
                  key={label}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 hover:shadow-md"
                >
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {index + 1}
                  </span>
                  <h2 className="mt-3 text-lg font-medium tracking-tight">{label}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <div className="max-w-xl">
              <h2 className="text-3xl font-semibold tracking-tight">Everything in one workspace</h2>
              <p className="mt-3 text-muted-foreground">
                Storage, notes, search, and AI retrieval — built for teams that need reliable
                answers from their own data.
              </p>
            </div>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className={cn(
                    featureCardClass,
                    "lg:col-span-2",
                    featureLayoutClass[title],
                    title === "Recall agent" && "bg-linear-to-br from-card to-primary/5"
                  )}
                >
                  <h3 className="flex items-center gap-2 font-medium">
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        title === "Recall agent" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-muted/40 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Simple pricing</h2>
              <p className="mt-3 text-muted-foreground">
                Free to start. Upgrade when you need more storage and agent usage.
              </p>
            </div>
            <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
              {PLAN_LIST.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    featureCardClass,
                    "relative",
                    plan.id === "PRO" && "border-primary/30 shadow-md ring-1 ring-primary/10"
                  )}
                >
                  {plan.id === "PRO" && (
                    <Badge className="absolute -top-2.5 left-4 text-[10px]">Most popular</Badge>
                  )}
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
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-12 text-center md:px-12 md:py-14">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/8 via-transparent to-primary/5"
              />
              <div className="relative">
                <h2 className="text-3xl font-semibold tracking-tight">Ready to get started?</h2>
                <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                  {isLoggedIn
                    ? "Pick up where you left off — your library is waiting."
                    : "Create a workspace in minutes. Upload your files and start asking questions with cited answers."}
                </p>
                <Link
                  href={primaryHref}
                  className={cn(buttonVariants({ size: "lg" }), "mt-8 gap-2 px-5")}
                >
                  {isLoggedIn ? "Open your library" : "Create your library"}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row md:px-8">
          <p>
            <span className="font-medium text-foreground">wenlo</span>
            <span className="mx-2 text-border">·</span>
            recalls.sh
          </p>
          <nav className="flex items-center gap-4">
            <Link href="#features" className="transition-colors hover:text-foreground">
              Features
            </Link>
            <Link href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </Link>
            {!isLoggedIn && (
              <Link href="/login" className="transition-colors hover:text-foreground">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}

const mockFolders = [
  { name: "Strategy", color: "blue" },
  { name: "Product specs", color: "green" },
  { name: "Customer research", color: "orange" },
] as const;

const mockSources = [
  {
    title: "Q3 retention goals — notes",
    snippet:
      "…target 92% logo retention for enterprise accounts, with expansion revenue from seats added in H2…",
    badge: "keyword + semantic",
  },
  {
    title: "Product roadmap — Q3.pdf",
    snippet:
      "…onboarding improvements and admin reporting are prioritized to reduce churn in the first 90 days…",
    badge: "semantic",
  },
];

function AppMockup() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-primary/10 ring-1 ring-border/80">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-red-500/80" />
        <span className="size-2.5 rounded-full bg-yellow-500/80" />
        <span className="size-2.5 rounded-full bg-green-500/80" />
        <div className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Product Team</span>
          <span className="opacity-50">/</span>
          <span className="inline-flex items-center gap-1 text-foreground">
            <Sparkles className="size-3" />
            Recall
          </span>
        </div>
      </div>

      <div className="flex min-h-104">
        <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground sm:flex">
          <div className="flex items-center gap-2 px-2 py-2">
            <LibraryIcon icon="target" className="size-5" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">Product Team</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </div>

          <div className="space-y-0.5 px-2 pb-2">
            <MockNavItem icon={House} label="Home" />
            <MockNavItem icon={Search} label="Search" />
            <MockNavItem icon={Sparkles} label="Recall" active />
          </div>

          <div className="mx-1 flex items-center justify-between px-2 py-2">
            <span className="text-xs font-medium text-muted-foreground">Private</span>
          </div>

          <nav className="flex-1 space-y-0.5 px-1 pb-2 text-sm">
            {mockFolders.map((folder) => (
              <div
                key={folder.name}
                className="flex items-center gap-1.5 py-0.5 pl-1"
              >
                <FolderArtwork color={folder.color} className="size-4 shrink-0" />
                <span className="truncate text-muted-foreground">{folder.name}</span>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-foreground/40" />
              Product Team · All
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-hidden p-4">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                What were our Q3 retention goals?
              </div>
            </div>

            <div className="space-y-3">
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-muted/60 px-3.5 py-2.5 text-sm leading-relaxed text-foreground/90">
                Enterprise logo retention is targeted at{" "}
                <span className="font-medium text-foreground">92%</span> for Q3, with expansion revenue
                from additional seats in H2. Onboarding and admin reporting improvements are prioritized to
                reduce churn in the first{" "}
                <span className="font-medium text-foreground">90 days</span>.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">2 sources</p>
                {mockSources.map((source) => (
                  <div
                    key={source.title}
                    className="rounded-lg border border-border bg-card p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {source.title}
                      </span>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                        {source.badge}
                      </Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                      {source.snippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border p-3">
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
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-sm",
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

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
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { PLAN_LIST } from "@/lib/plans";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: FolderTree,
    title: "Libraries & folders",
    description:
      "Organize notes, PDFs, slides, and code the way you think — drag, nest, color-code.",
  },
  {
    icon: Upload,
    title: "Upload anything",
    description: "Drop files in. Text is extracted and indexed automatically.",
  },
  {
    icon: Search,
    title: "Grep + semantic search",
    description: "Exact matches when you want them. Meaning when you need it.",
  },
  {
    icon: Sparkles,
    title: "Recall agent",
    description: "Ask questions scoped to a folder or your whole library — with sources.",
  },
  {
    icon: Brain,
    title: "Rich pages",
    description: "BlockNote editor with code blocks, diagrams, and images.",
  },
  {
    icon: Terminal,
    title: "CLI & API",
    description: "Ingest, export, and query libraries from scripts and agents.",
  },
];

const steps = [
  { label: "Collect", detail: "Pages, PDFs, slides — one home for everything you learn." },
  { label: "Find", detail: "Grep-fast keyword search or semantic recall when words fail." },
  { label: "Ask", detail: "An agent that reads your library and cites where it looked." },
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
        <div className="landing-orb landing-orb-2 absolute top-[18%] -right-20 size-[22rem] rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10" />
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
              Personal coding knowledge base
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
              Remember everything you&apos;ve read, written, and shipped
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-pretty md:text-xl">
              Notes, PDFs, lecture slides, and code — organized like Obsidian, searchable like
              grep, answerable by an AI that knows your library.
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

          <div className="mx-auto mt-12 max-w-xl md:mt-14">
            <div className="overflow-hidden rounded-xl border border-border/80 bg-card/70 shadow-lg shadow-primary/5 backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-border/80 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-red-500/80" />
                <span className="size-2.5 rounded-full bg-yellow-500/80" />
                <span className="size-2.5 rounded-full bg-green-500/80" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  ~/projects/ml-notes
                </span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-relaxed sm:p-5 sm:text-sm">
                <code>
                  <span className="text-muted-foreground">$ </span>
                  <span className="text-primary">recall</span>
                  <span className="text-foreground">
                    {" "}
                    &quot;how does rotary positional encoding work?&quot;
                  </span>
                  {"\n\n"}
                  <span className="text-emerald-500/90 dark:text-emerald-400/90">→</span>
                  <span className="text-muted-foreground"> 3 matches in </span>
                  <span className="text-foreground">transformers/</span>
                  {"\n\n"}
                  <span className="text-foreground/90">
                    {"  "}[page] Attention Is All You Need — notes
                  </span>
                  {"\n"}
                  <span className="text-muted-foreground">
                    {"         "}…sin/cos functions of different frequencies…
                  </span>
                  {"\n\n"}
                  <span className="text-foreground/90">{"  "}[pdf] CS224N Lecture 5 — slides</span>
                  {"\n"}
                  <span className="text-muted-foreground">
                    {"         "}…relative positions via rotation in complex space…
                  </span>
                </code>
              </pre>
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
                Built for how you actually learn
              </h2>
              <p className="mt-3 text-muted-foreground">
                Collect once. Search instantly. Ask when grep isn&apos;t enough.
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
                Free to start. Upgrade when you need more AI tokens.
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
              Your second brain, queryable
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              {isLoggedIn
                ? "Pick up where you left off — your library is waiting."
                : "Sign up in seconds. Upload your first PDF. Ask your first question."}
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
            <span className="text-foreground">recalls</span>.sh — MIT License
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

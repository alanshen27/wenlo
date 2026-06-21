# Studious → wenlo: UI migration & design spec

How to turn **Studious** into a **wenlo sub-product** — not a recolor.

> **Status:** design spec / agent guide. Docs-only. No code in this file is "done"
> until a screen actually adopts it. Read §0 before touching anything.

---

## 0. Read this first — the recolor trap

Every prior attempt at this failed the same way: swap `--primary`, call it done, ship
**"Studious with wenlo colours."** It looks worse than before because now it's
incoherent — wenlo's palette on Studious's bones (loud hovers, hard-flat surfaces,
uppercase labels, wrong radius, wrong density).

**A real migration changes four layers. Color is the smallest.**

| Layer | Recolor (wrong) | Real migration (right) |
|-------|-----------------|------------------------|
| **Color** | swap `--primary` | move the *whole neutral ramp* to oklch 262° family |
| **Structure** | unchanged | `rounded-xl` cards, 240px sidebar, fixed rails, 7xl/3xl/lg columns |
| **Density** | unchanged | wenlo spacing tokens, `h-8` controls, stepped type scale |
| **Interaction** | unchanged | calm hover, `translate-y-px` press, overlay-only depth, optimistic updates |
| **Voice** | unchanged | sentence case everywhere, "hover is a whisper", undo over confirm |

If you only edited `globals.css` color values, **you have not done the migration.**
The acceptance gate in §16 exists to catch exactly this.

---

## 1. Brand architecture — Studious *belongs to* wenlo

The goal is "Studious, by wenlo": a user who lives in wenlo (libraries, Recall, files)
opens Studious and never feels they left — same surfaces, same calm, same motion —
but with education structure (classes, agenda, grading) and **one** distinct accent.

**Three commitments:**

1. **One token system.** wenlo's oklch tokens *are* Studious's tokens. No parallel palette.
2. **One interaction grammar.** wenlo's calm hover/press, overlay-only depth,
   border-intensify cards. Studious gives up flat-poster energy (`scale-105`, zero-shadow-everywhere, uppercase rails).
3. **One reserved identity lever.** Studious keeps exactly one expressive thing:
   its **accent hue + domain iconography**. Everything else conforms.

### 1.1 The identity slot — accent as a theme class

wenlo supports accent theme classes on `<html>`. Make Studious's brand its accent, so
**every wenlo component re-themes via one token block — zero component edits.** That is
the entire identity mechanism.

```css
/* Studious sub-product accent — a scholarly indigo, cousin of wenlo's 256° */
.studious {
  --primary: oklch(0.55 0.19 270);
  --primary-foreground: oklch(0.985 0.004 270);
  --ring: oklch(0.55 0.17 270);
  --sidebar-primary: oklch(0.55 0.19 270);
  --sidebar-ring: oklch(0.55 0.17 270);
}
.dark.studious {
  --primary: oklch(0.66 0.17 270);
  --primary-foreground: oklch(0.985 0.004 270);
  --ring: oklch(0.66 0.15 270);
}
```

Apply `.studious` on the app root. Buttons, focus rings, active nav, KPI tiles all
follow automatically.

### 1.2 Studious keeps / gives up

**Keeps:** education iconography (rendered via `FileArtwork`/`IconFrame`, not bespoke
SVGs), per-record colors (class/event color) **as markers only** (dot, 3px left bar),
the agenda calendar layout (re-themed, not rebuilt).

**Gives up:** the four hard brand hexes as a *palette* (demoted to optional KPI-tile
tints), `hover:scale-105` buttons, `scale(1.02)` nav, "zero shadows anywhere",
uppercase dashboard labels, JetBrains Mono.

---

## 2. Tokens — oklch, neutral-cool family

wenlo neutrals ride a single cool hue (**262°**, chroma ≤ 0.016 — never pure gray,
never warm); the brand sits at **256°**. That cool cast is the family signature.
Studious's HSL slate is close-but-wrong; it must move onto these exact values.

### 2.1 Light (paste targets)

| Token | oklch |
|-------|-------|
| `--background` | `oklch(0.993 0.002 262)` |
| `--foreground` | `oklch(0.21 0.016 262)` |
| `--card` / `--popover` | `oklch(1 0.0015 262)` |
| `--muted` | `oklch(0.965 0.004 262)` |
| `--muted-foreground` | `oklch(0.505 0.016 262)` |
| `--accent` | `oklch(0.957 0.007 262)` |
| `--secondary` | `oklch(0.967 0.004 262)` |
| `--border` / `--input` | `oklch(0.915 0.006 262)` |
| `--sidebar` | `oklch(0.981 0.004 262)` |
| `--sidebar-hover` | `oklch(0.955 0.006 262)` |
| `--sidebar-active` | `oklch(0.93 0.009 262)` |
| `--primary` *(base; overridden by `.studious`)* | `oklch(0.58 0.2 256)` |

### 2.2 Studious-only tokens to keep (restated in oklch)

`--warning`, `--success`, `--ai`/`--ai-muted`/`--ai-border`,
`--surface`/`--surface-raised`/`--surface-subtle`, and the `--p-*` spacing scale.
These are genuinely useful; wenlo can adopt them too.

### 2.3 Consumption

wenlo stores *final* colors and consumes `var(--x)` (no `hsl()` wrapper). Map once in
`@theme inline` (`--color-primary: var(--primary)`), then `bg-primary` resolves
directly. Any `hsl(var(--x))` left in custom CSS (the agenda block) becomes `var(--x)`.

### 2.4 Depth philosophy (critical, not a color)

- **Content is flat.** Cards get a border and *intensify* it on hover
  (`hover:border-foreground/30`) — **never a shadow.**
- **Overlays lift.** Popover / dropdown / dialog / toast / command menu:
  `shadow-md ring-1 ring-foreground/10` + zoom-fade in.

This *replaces* Studious's "zero depth ever." Studious keeps flat dashboards, gains
the overlay treatment and border-hover idiom.

---

## 3. Spacing — one 4px grid, named where it matters

Quantize to **4px**. Use Tailwind's numeric scale for ordinary layout; use named
tokens when the value should track the system globally.

| Token | rem | px | For |
|-------|-----|----|-----|
| `--p-tight` | 0.25 | 4 | inline icon↔text, dense internals |
| `--p-compact` | 0.5 | 8 | small card / row padding |
| `--p-control` | 0.625 | 10 | button / input inset |
| `--p-card` | 1 | 16 | dense card body |
| `--p-page` | 1.5 | 24 | page block spacing |
| `--p-page-x` | 1 | 16 | horizontal chrome inset |
| `--p-page-y` | 0.75 | 12 | vertical chrome inset |
| `--p-section` | 2 | 32 | major section gap |

Expose in v4: `--spacing-page-x: var(--p-page-x)` etc. → enables `px-page-x`, `p-card`, `gap-tight`.

**Component contracts (standardize):**

| Element | Spacing |
|---------|---------|
| Content card | `rounded-xl`, `gap-6`, body `px-6` |
| Dense tile | `p-card`, value→meta `mt-0.5` |
| List row | `px-4 py-2`, leading gap `gap-3` |
| Form | field stack `space-y-5`, label→input `space-y-2` |
| Button | `h-8`, `px-3`, icon gap `gap-2` |
| Page sections | `space-y-6`; hero→first `space-y-8` |

**Prose rhythm:** space above a heading = its font-size (h1 32 / h2 24 / h3 18px).

**Density tiers** (never mix within one surface): Comfortable (`space-y-6 p-6`, `text-sm/base`)
· Standard (`space-y-4 p-4`, `text-sm`) · Dense (`gap-1 px-2 py-0.5`, `text-2xs/micro`).

---

## 4. Typography — Inter + Geist Mono, one stepped scale

| Role | size px | line-height | weight | tracking |
|------|---------|-------------|--------|----------|
| Document title | 40 | 1.2 | 700 | −0.02em |
| App page title (`PageHeader`) | 24 / 20 | 1.2 | 700 | tight |
| Prose h1 | 30 | 1.25 | 600 | −0.01em |
| Prose h2 | 24 | 1.25 | 600 | −0.01em |
| Prose h3 / card section title | 20 / 18 | 1.25 | 600 | −0.01em |
| Body | 16 | 1.6 | 400 | normal |
| UI / button | 14 | 1.25rem | 500 | normal |
| Nav pill | 13 | 1.375 | 400 | normal |
| Label / meta | 12 | 1.25rem | 400 | normal |
| Dense micro / 2xs | 11 / 10 | 1rem | 500 | normal |

**Four rules:**
1. **Sentence case everywhere.** No `uppercase`, no `tracking-wide` on chrome.
   *(Biggest text change for Studious — its dashboard rails go sentence-case.)*
2. **Negative tracking ≥20px only;** ≤16px is `normal`.
3. **`tabular-nums` on every number** (grades, dates, counts, KPIs, meters).
4. **Weight carries hierarchy:** body 400 · UI/label 500 · heading 600 · title 700. No orphan sizes.

Mono → **Geist Mono** (`--font-geist-mono`). Sans → Inter (`--font-inter`), via `--font-*`, never per-component imports.

---

## 5. Positioning & layout

**Columns:** reading `mx-auto max-w-3xl` (768) · settings `max-w-lg` (512) · fluid
`max-w-7xl` (1280). Bring Studious's 1400 container in to 7xl. Inset `px-page-x`, `py-page-y`.

**Shell:** sidebar `w-[240px] shrink-0 bg-sidebar border-r`, items use
`.sidebar-item`/`.sidebar-item-active` (background step, **no transform**). Right rails
(outline / contextual panel) are **`fixed right-6`** — never in flex flow, or the
centered column shifts when they mount.

**Scroll:** outer column owns scroll (scrollbar at viewport edge). Inner rails use
`scrollbar-subtle` (thin, thumb on hover) or `scrollbar-none`. The agenda's bespoke
scrollbar CSS is replaced by `scrollbar-subtle`.

**z-index:** content auto · sticky headers + fixed rails `z-10` · all overlays `z-50`.
No `z-20/30` one-offs.

**Responsive:** `min-[980px]:` is the mobile↔desktop split (matches sidebar appearance).
Sticky-blur header on mobile (`sticky top-0 z-10 bg-background/95 backdrop-blur
supports-[backdrop-filter]:bg-background/80 min-[980px]:static`). Bottom-nav offset
`pb-[calc(5rem+env(safe-area-inset-bottom,0px))]`. Touch targets `h-9`+ on mobile.

**Card galleries** live on `bg-background`, never wrapped in a card:
`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`, fixed thumbnail aspect.

---

## 6. Components

### 6.1 Button — the most visible tell

| | Studious now | → target |
|---|--------------|----------|
| Size | `h-9` | `h-8` |
| Radius | `rounded-md` | `rounded-lg` |
| Hover | `bg-primary-hover` + `scale-105` | `bg-primary/80`, **no scale** |
| Press | — | `active:translate-y-px` |
| Destructive | solid | tinted `bg-destructive/10 text-destructive` in-context; solid only in confirm dialogs |
| Sizes | xs/sm/default/lg/icon | add `icon-xs`, `icon-sm` |

**Deleting `hover:scale-105` is the single highest-impact edit in the whole migration.**

### 6.2 Card — `rounded-lg` → `rounded-xl`, `gap-6`/`px-6`, clickable = `hover:border-foreground/30` (no shadow). No card-in-card (both products already enforce).

### 6.3 Section labels — `text-xs font-semibold uppercase tracking-wide` → sentence-case `text-xs text-muted-foreground`. `CardTitle` default → override `text-lg` for inner sections.

### 6.4 Sidebar — replace `.nav-item`/`.nav-active` (with `scale(1.02)`) with `.sidebar-item`/`.sidebar-item-active` (background step only).

### 6.5 Overlays — Dialog/Popover/Dropdown/Sonner get `bg-popover rounded-lg shadow-md ring-1 ring-foreground/10` + zoom-fade. This is where Studious *adds* depth.

### 6.6 Already aligned — `EmptyState`, `StatsCard`, `IconFrame`, `Kbd`, `Command`, `PageLayout`: keep, re-token, adopt radius/motion. Candidates to upstream into a shared layer later.

---

## 7. Interaction states — the productivity layer

Every interactive surface specifies **all** applicable states. This is where "fast and
trustworthy" actually lives — and what recolors skip entirely.

| State | Treatment |
|-------|-----------|
| default | base tokens |
| hover | bg/border step only — `hover:bg-muted/40` (rows), `hover:border-foreground/30` (cards), `hover:bg-accent` (menu items) |
| focus-visible | `outline-none ring-2 ring-ring` (offset 1px) — **always `focus-visible`, never `focus`** |
| active (press) | `translate-y-px`; no scale |
| selected | `bg-sidebar-active` / `aria-selected:bg-muted` |
| disabled | `opacity-50 pointer-events-none` |
| loading | inline `Loader2 animate-spin` before label; control stays sized |
| dragging | `opacity-60`, follow cursor; source keeps slot |
| drop-target | `2px` accent drop-line or `ring-2 ring-ring/40` |
| error | `border-destructive ring-destructive/20` + message |

A single list row therefore has ~8 states, not 2. Spec them per surface.

---

## 8. Async, optimism, save status

- **Optimistic by default** for every meaningful mutation — the four-callback dance:
  `onMutate` patches cache → `onError` rolls back → `onSuccess` finalizes →
  `onSettled` reconciles. The list hook owns the cache; rows receive `onDelete`, not callback chains.
- **Save status grammar:** `idle` → `Saving…` → `Saved` → `Offline — will retry`.
  Inline near the edited field for docs; in the top bar for whole-page editors.
- **Skeletons, not spinners.** One skeleton per surface, shaped like the result
  (`Skeleton` blocks matching final layout). Provide `loading.tsx` next to any
  `page.tsx` that hits the network. Overlay reloads: `pointer-events-none absolute
  inset-0 z-10 backdrop-blur-[2px]`.

---

## 9. Keyboard & command surface

- **⌘K palette IA:** recents (no query) → search results → actions; scope to current
  library/class with a global fallback.
- **Shortcut map:** `g` then destination (`g l` library, `g a` agenda), `⌘⏎` submit,
  `esc` closes top layer / clears selection. Render hints with `Kbd`/`KbdGroup`.
- **Focus discipline:** dialogs trap focus and restore to trigger on close; trees use
  roving `tabindex`; menus are arrow-navigable. Every interactive non-`<Button>` has a
  visible `focus-visible` ring.

---

## 10. Tables, trees, multi-select

- **Tables (`DataTable`):** sticky header, hairline rows (not zebra), sortable headers,
  row actions revealed on hover (`opacity-0 group-hover:opacity-100`), `tabular-nums`
  columns, pagination over infinite for bounded sets.
- **Multi-select:** checkbox column, shift-range select, a bulk-action bar that slides
  up from the bottom on first selection; `esc` clears.
- **Trees (folder/class sidebar):** expand/collapse with chevron, drag-reparent with a
  drop-line indicator, auto-scroll at viewport edges, keyboard arrows + `enter` to open.

---

## 11. Empty → one → many

Every list needs three designs:

1. **Empty:** `EmptyState` (icon in `bg-muted` circle, title, description, one CTA).
2. **First item:** the row pattern, not a special case.
3. **Many:** virtualized/paginated, dense tier.

Designing only "many" is why fresh accounts look broken. Spec all three.

---

## 12. Notifications, errors, undo

- **Toasts (`sonner`):** success / info / error / loading-then-resolve. Short, sentence case.
- **Errors:** inline under the field for form validation; banner only for surface-wide failures.
- **Undo over confirm.** Destructive actions (delete, archive, remove) act immediately
  + show an undo toast. Reserve confirm dialogs for irreversible/bulk-destructive
  (delete account, purge trash).

---

## 13. Accessibility & motion

- **Motion budget — "hover is a whisper":** `transition-colors` for state; overlays
  zoom-fade `95→100`; **no** entrance drift, glow, or `scale` pops. Honor
  `prefers-reduced-motion` (disable non-essential transitions).
- **Contrast:** body text ≥ 4.5:1; muted ≥ 3:1; never ship `text-green-600` without
  `dark:text-green-400` for non-token status colors.
- **ARIA:** correct roles for tree/menu/dialog/tablist; `aria-selected`, `aria-expanded`,
  labeled icon-only buttons.

---

## 14. Domain surfaces (education)

- **Agenda calendar:** re-theme, don't rebuild. `hsl(var(--x))` → `var(--x)`; today
  pill + now-indicator use `--primary`/`--destructive`; weekday headers sentence-case,
  drop letter-spacing; events as left-bar/dot markers; scrollbar → `scrollbar-subtle`.
- **Class tiles:** wenlo content-card (`rounded-xl`, border-intensify), class color as
  a dot/left-bar marker only.
- **Grading:** keep green/yellow/red scales but **always** ship `dark:` pairs.
- **KPI dashboards:** `StatsCard` + `IconFrame`, optionally tinted by the four legacy
  brand hexes (now "tile tints only").

---

## 15. Migration phases

| Phase | Scope | Win |
|-------|-------|-----|
| 0 Decisions | accent hue, v4 vs interim, label-case move | — |
| 1 Tokens | oklch neutrals + Studious accent, sidebar steps, radius, Geist Mono | whole app shifts onto family palette |
| 2 Interaction | strip `scale`; add `translate-y-px`; `rounded-xl`; overlay shadow+ring | feels calm & on-brand |
| 3 Voice | sentence-case labels; `.sidebar-item`; soften agenda type | *feels* wenlo, not just matches |
| 4 Domain | agenda / class tiles / grading / KPIs | education surfaces join family |
| 5 Shell | app-launcher entry, shared header + ⌘K + settings, `next-themes` | one product family |
| 6 Build | full Tailwind v4 cutover (if Phase 1 used interim) | build parity |

Ship each phase independently; never broken between phases.

---

## 16. Acceptance gate — "is this a real merge or a recolor?"

**Fail the PR if any of these is false:**

- [ ] Toggling `.studious` on `<html>` re-themes the whole app via one token block — **no per-component color edits**.
- [ ] Cards are `rounded-xl` with border-intensify hover and **no shadow**; overlays have `shadow-md ring-1`.
- [ ] **No `hover:scale-*`** anywhere on buttons/cards/nav; press is `translate-y-px`.
- [ ] **No `uppercase`/`tracking-wide`** on chrome; labels are sentence case.
- [ ] Controls are `h-8`; spacing uses `--p-*`; type uses the stepped scale.
- [ ] Mono is Geist Mono; sans Inter; neutrals are oklch 262° (not slate HSL).
- [ ] Every list has empty/one/many; every mutation is optimistic; loading is a skeleton.
- [ ] Destructive actions use **undo**, not confirm (except irreversible).
- [ ] Sidebar `w-[240px]`; right rails `fixed`; outer column scrolls; `min-[980px]:` split.
- [ ] Side-by-side, a wenlo page and a Studious page read as **the same product**.

> If the diff is mostly `globals.css` color values, it failed. A real migration touches
> components, layout, spacing, motion, and copy.

---

## 17. Pitfalls

| Pitfall | Why it breaks the family |
|---------|--------------------------|
| Keep Studious blue as global `--primary` | two primaries = two brands; make it the accent class |
| Port components but leave HSL slate | "close but off" — the cool-neutral cast is the signature |
| Keep `scale-105` "for life" | loudest non-wenlo tell |
| Uppercase dashboard labels | fine in flat-poster Studious, alien here |
| Shadows on content cards | depth is reserved for overlays |
| Rebuild the agenda | throws away working layout for no gain |
| Skip `dark:` on grade colors | half-dark status looks broken |
| Confirm dialogs everywhere | wenlo prefers undo; confirms feel heavy |
| Design only the "many" state | fresh accounts look broken on day one |

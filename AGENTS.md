<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Native home pages (`/docs`, `/slides`, etc.)

`src/components/native/native-home.tsx` is the Word-style launcher for each native type. Keep its UI aligned with the existing design system — do not invent a parallel visual language.

**Do**
- Use `FileArtwork` for type icons (same as the library sidebar and file tree).
- Use existing tokens and patterns: `border-border`, `bg-card`, `bg-muted/40`, `text-muted-foreground`, standard card hover (`hover:border-foreground/30`, `hover:shadow-md`).
- Put visual richness in **template content** (slide themes, board stickies, page blocks) — not on the picker cards.
- Reuse the existing mini-page preview pattern (white page mock + title + `preview` excerpt) for doc/database template and recent cards.
- Templates live on `/<kind>/templates` with preview cards — not in the sidebar list.

**Don't**
- Add per-template accent colors, gradient wells, colored dots/stripes, or tinted card backgrounds on the home grid.
- Replace `FileArtwork` with Lucide glyphs or custom SVGs for native types.
- Change section typography, card heights, or shadows in ways that diverge from the rest of the app without an explicit product ask.
- “Polish” blandness by restyling the home shell — improve template payloads and previews instead.

## UI polish feedback (“boring”, “bad”, “mediocre”, etc.)

When the user says something looks boring, bland, mediocre, or off — **do not** reach for a different visual language. They mean fix the specific surface within the existing design system, not redecorate the app.

**Do**
- Tighten layout, spacing, alignment, and hierarchy on the surface they’re looking at.
- Reuse existing components and tokens (`Button`, `border-border`, `bg-card`, `bg-sidebar`, `text-muted-foreground`, `hover:border-foreground/30`, etc.).
- Match patterns from neighboring UI (sidebar, `MainHeader`, cards, modals) — read those files first.
- Fix real UX issues: unclear affordances, weak structure, wrong icons, broken tab/page joins, redundant chrome.

**Don't**
- Add app-wide or one-off **gradients**, **glow orbs**, **hero accent washes**, or **per-section color themes** unless explicitly asked.
- Introduce **animations** (drift, blur-on-hover, entrance motion) to “add life” — especially on marketing or shell chrome.
- Invent new **typography scales** (random `uppercase` section labels, oversized headlines, mixed `text-xs` / `text-sm` / `text-lg` on the same bar) instead of aligning with what’s already there.
- Swap in Lucide/icon frames, tinted cards, or shadow/ring combos that don’t appear elsewhere in the product.
- Interpret “more corporate” or “less boring” as “more effects” — usually it means clearer, calmer, and more consistent.

If a change would only be justified on one page and nowhere else in the app, it’s probably the wrong fix.

## Document surfaces & Notion-like typography

Page editor, outline rail, and other long-form reading UI should feel like **Notion** — calm hierarchy, sentence-case labels, pill hovers. Read `globals.css` (`.notion-page-title`, `.notion-sidebar-label`, `.notion-nav-pill`) and `document-outline.tsx` before changing these surfaces.

**Do**
- Use **sentence case** for section labels and chrome titles (`On this page`, not `ON THIS PAGE`). Never use `uppercase`, `tracking-wide`, or `tracking-widest` on section headings or nav group labels.
- Side nav / outline links: `.notion-nav-pill` — small text (`~13px`), muted default, **rounded pill background on hover** (`bg-muted`).
- Page title: `.notion-page-title` — large, semibold/bold, tight negative letter-spacing.
- Body & block headings: match existing `.notion-editor` scale in `globals.css` (paragraph `1rem/1.6`, h1–h3 stepped sizes, `font-weight: 600` on headings).
- Scroll long document layouts on the **outer** column so the scrollbar sits at the viewport edge, not between content and a side rail. Use `.scrollbar-subtle` (thin thumb, visible on hover) or `.scrollbar-none` for inner rails.
- Document outline (`DocumentOutline`): **fixed** on the far right (`fixed right-6`) — it must not sit in the page flex flow or the centered column shifts. Page body stays `mx-auto max-w-3xl`.

**Don't**
- All-caps section labels, badge-style `text-[10px] uppercase` headers, or letter-spaced “UI chrome” titles on document surfaces.
- Default thick scrollbars splitting content from a sticky outline.
- Text-only hover (color flip only) on outline/nav items — use the pill hover pattern.
- New one-off font sizes on page chrome; extend the Notion classes in `globals.css` instead.


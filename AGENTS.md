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

**Don't**
- Add per-template accent colors, gradient wells, colored dots/stripes, or tinted card backgrounds on the home grid.
- Replace `FileArtwork` with Lucide glyphs or custom SVGs for native types.
- Change section typography, card heights, or shadows in ways that diverge from the rest of the app without an explicit product ask.
- “Polish” blandness by restyling the home shell — improve template payloads and previews instead.


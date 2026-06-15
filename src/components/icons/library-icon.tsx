import {
  Brain,
  Code2,
  Compass,
  FlaskConical,
  Globe,
  GraduationCap,
  Leaf,
  Library,
  NotebookPen,
  Palette,
  Rocket,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_LIBRARY_ICON } from "@/lib/library/folder-colors";
import { cn } from "@/lib/core/utils";

export { DEFAULT_LIBRARY_ICON };

export type LibraryIconDef = {
  id: string;
  label: string;
  Glyph: LucideIcon;
  /** Tailwind solid background color class for the flat tile. */
  color: string;
};

/**
 * A curated set of hand-designed workspace icons. Each is a flat solid-color
 * tile with a white glyph — a cohesive "app icon" look rather than raw emojis.
 */
export const LIBRARY_ICON_DEFS: LibraryIconDef[] = [
  { id: "books", label: "Library", Glyph: Library, color: "bg-indigo-500" },
  { id: "brain", label: "Knowledge", Glyph: Brain, color: "bg-fuchsia-500" },
  { id: "code", label: "Code", Glyph: Code2, color: "bg-blue-500" },
  { id: "lab", label: "Research", Glyph: FlaskConical, color: "bg-emerald-500" },
  { id: "compass", label: "Design", Glyph: Compass, color: "bg-amber-500" },
  { id: "trophy", label: "Goals", Glyph: Trophy, color: "bg-yellow-500" },
  { id: "notes", label: "Notes", Glyph: NotebookPen, color: "bg-sky-500" },
  { id: "target", label: "Focus", Glyph: Target, color: "bg-rose-500" },
  { id: "spark", label: "Energy", Glyph: Zap, color: "bg-violet-500" },
  { id: "globe", label: "Global", Glyph: Globe, color: "bg-cyan-500" },
  { id: "rocket", label: "Launch", Glyph: Rocket, color: "bg-orange-500" },
  { id: "palette", label: "Creative", Glyph: Palette, color: "bg-pink-500" },
  { id: "study", label: "Study", Glyph: GraduationCap, color: "bg-blue-600" },
  { id: "nature", label: "Nature", Glyph: Leaf, color: "bg-green-500" },
];

export const LIBRARY_ICON_IDS = LIBRARY_ICON_DEFS.map((d) => d.id);

const DEFS_BY_ID = new Map(LIBRARY_ICON_DEFS.map((d) => [d.id, d]));

/** Maps legacy emoji icons (previously stored) onto the new designed icon ids. */
const LEGACY_EMOJI_TO_ID: Record<string, string> = {
  "📚": "books",
  "🧠": "brain",
  "💻": "code",
  "🔬": "lab",
  "📐": "compass",
  "🏆": "trophy",
  "📝": "notes",
  "🎯": "target",
  "⚡": "spark",
  "🌐": "globe",
  "🚀": "rocket",
  "🎨": "palette",
  "🎓": "study",
  "🌿": "nature",
};

export function resolveLibraryIcon(icon: string | null | undefined): LibraryIconDef {
  if (icon) {
    const direct = DEFS_BY_ID.get(icon);
    if (direct) return direct;
    const legacy = LEGACY_EMOJI_TO_ID[icon];
    if (legacy) return DEFS_BY_ID.get(legacy)!;
  }
  return DEFS_BY_ID.get(DEFAULT_LIBRARY_ICON)!;
}

type Props = {
  icon: string | null | undefined;
  /** Controls the size of the tile, e.g. `size-5`. */
  className?: string;
};

export function LibraryIcon({ icon, className }: Props) {
  const def = resolveLibraryIcon(icon);
  const { Glyph } = def;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[28%] text-white",
        def.color,
        className ?? "size-5"
      )}
    >
      <Glyph className="size-[58%]" strokeWidth={2.25} />
    </span>
  );
}

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
  /** Tailwind gradient stops, used with `bg-linear-to-br`. */
  gradient: string;
};

/**
 * A curated set of hand-designed workspace icons. Each is a gradient tile with a
 * white glyph — a cohesive "app icon" look rather than raw emojis.
 */
export const LIBRARY_ICON_DEFS: LibraryIconDef[] = [
  { id: "books", label: "Library", Glyph: Library, gradient: "from-indigo-500 to-violet-600" },
  { id: "brain", label: "Knowledge", Glyph: Brain, gradient: "from-fuchsia-500 to-pink-600" },
  { id: "code", label: "Code", Glyph: Code2, gradient: "from-cyan-500 to-blue-600" },
  { id: "lab", label: "Research", Glyph: FlaskConical, gradient: "from-emerald-500 to-teal-600" },
  { id: "compass", label: "Design", Glyph: Compass, gradient: "from-amber-500 to-orange-600" },
  { id: "trophy", label: "Goals", Glyph: Trophy, gradient: "from-yellow-400 to-amber-600" },
  { id: "notes", label: "Notes", Glyph: NotebookPen, gradient: "from-sky-500 to-blue-600" },
  { id: "target", label: "Focus", Glyph: Target, gradient: "from-rose-500 to-red-600" },
  { id: "spark", label: "Energy", Glyph: Zap, gradient: "from-violet-500 to-purple-600" },
  { id: "globe", label: "Global", Glyph: Globe, gradient: "from-cyan-500 to-sky-600" },
  { id: "rocket", label: "Launch", Glyph: Rocket, gradient: "from-orange-500 to-rose-600" },
  { id: "palette", label: "Creative", Glyph: Palette, gradient: "from-pink-500 to-fuchsia-600" },
  { id: "study", label: "Study", Glyph: GraduationCap, gradient: "from-blue-500 to-indigo-600" },
  { id: "nature", label: "Nature", Glyph: Leaf, gradient: "from-green-500 to-emerald-600" },
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
        "inline-flex shrink-0 items-center justify-center rounded-[28%] bg-linear-to-br text-white shadow-sm ring-1 ring-black/10",
        def.gradient,
        className ?? "size-5"
      )}
    >
      <Glyph className="size-[58%]" strokeWidth={2.25} />
    </span>
  );
}

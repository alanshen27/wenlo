import { forwardRef, type ReactNode } from "react";
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  StickyNote,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { getFolderColorHex } from "@/lib/library/folder-colors";
import { cn } from "@/lib/core/utils";

/**
 * Custom glyphs for our three native, app-authored document types (slide decks,
 * rich-text pages, and whiteboards). They follow Lucide's drawing conventions
 * (24×24, `currentColor` stroke, round caps) so they can be used anywhere a
 * `LucideIcon` is expected and inherit sizing/color from `className`.
 */
function makeIcon(displayName: string, render: () => LucideProps["children"]): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(
    ({ className, strokeWidth = 2, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        {render()}
      </svg>
    )
  );
  Icon.displayName = displayName;
  return Icon as unknown as LucideIcon;
}

/** 24×24 stroke paths, shared by the inline icon and the large artwork glyph. */
const DECK_PATHS = (
  <>
    <rect x="7" y="3" width="14" height="14" rx="2" />
    <path d="M5 7v12a2 2 0 0 0 2 2h12" />
  </>
);

const PAGE_PATHS = (
  <>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
    <path d="M8 16h5" />
  </>
);

const BOARD_PATHS = (
  <>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M7 11c1.5-3 3-3 4.5 0s3 3 4.5 0" />
    <path d="M9 16l-1.5 5" />
    <path d="M15 16l1.5 5" />
  </>
);

const DATABASE_PATHS = (
  <>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </>
);

const FLOW_PATHS = (
  <>
    <rect x="4" y="3" width="7" height="5" rx="1" />
    <rect x="13" y="16" width="7" height="5" rx="1" />
    <path d="M7.5 8v3.5a2 2 0 0 0 2 2H16.5V16" />
  </>
);

/** Slide deck: two stacked cards. */
export const DeckIcon = makeIcon("DeckIcon", () => DECK_PATHS);

/** Rich-text page: rounded sheet with text lines. */
export const PageGlyph = makeIcon("PageGlyph", () => PAGE_PATHS);

/** Whiteboard: framed canvas with a drawn stroke and legs. */
export const BoardGlyph = makeIcon("BoardGlyph", () => BOARD_PATHS);

/** Database: a stacked cylinder (the classic database glyph). */
export const DatabaseGlyph = makeIcon("DatabaseGlyph", () => DATABASE_PATHS);

/** Flowchart: two nodes joined by a connector. */
export const FlowGlyph = makeIcon("FlowGlyph", () => FLOW_PATHS);

// Sheet + fold use the exact same outline as the generic file glyph so docs and
// slides share the regular icons' aspect ratio and visual size.
const DOC_SHEET = "M14 4 H30 L40 14 V40 a4 4 0 0 1 -4 4 H12 a4 4 0 0 1 -4 -4 V8 a4 4 0 0 1 4 -4 Z";
const DOC_FOLD = "M30 4 L40 14 H30 Z";

/**
 * Rich illustrative artwork (48×48) for our native, app-authored types. Unlike
 * the generic file glyph these are bespoke per type, built from filled shapes in
 * the type's palette so a deck, page, and board read at a glance.
 */
function nativeArtwork(type: string, p: ArtPalette): ReactNode | null {
  // Docs and slides follow the iconic Google Docs / Google Slides look: a
  // solid-color portrait sheet with a folded top-right corner and white content.
  const sheet = (
    <>
      <path d={DOC_SHEET} fill={p.accent} />
      <path d={DOC_FOLD} fill="#ffffff" fillOpacity={0.45} />
    </>
  );

  switch (type) {
    case "DECK":
      // Native deck: two stacked colored slides with a title + content bars.
      return (
        <>
          <rect x="9" y="9" width="30" height="22" rx="3" fill={p.accent} fillOpacity={0.35} />
          <rect x="7" y="16" width="34" height="24" rx="3.5" fill={p.accent} />
          <rect x="11" y="20" width="18" height="3" rx="1.5" fill="#ffffff" />
          <rect x="11" y="26" width="26" height="2.4" rx="1.2" fill="#ffffff" fillOpacity={0.7} />
          <rect x="11" y="31" width="22" height="2.4" rx="1.2" fill="#ffffff" fillOpacity={0.7} />
        </>
      );
    case "PAGE":
      // White text lines on the colored page (Google Docs / Word).
      return (
        <>
          {sheet}
          <rect x="14" y="21" width="20" height="2.6" rx="1.3" fill="#ffffff" />
          <rect x="14" y="26" width="20" height="2.6" rx="1.3" fill="#ffffff" />
          <rect x="14" y="31" width="20" height="2.6" rx="1.3" fill="#ffffff" />
          <rect x="14" y="36" width="12" height="2.6" rx="1.3" fill="#ffffff" />
        </>
      );
    case "WHITEBOARD":
      // Solid board with a white node-and-connector diagram so it reads as a
      // canvas of shapes.
      return (
        <>
          <rect x="8" y="4" width="32" height="40" rx="5" fill={p.accent} />
          <path d="M18 18 L30 31" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx="17" cy="17" r="5" fill="#ffffff" />
          <rect x="25" y="27" width="11" height="11" rx="2.5" fill="#ffffff" />
        </>
      );
    case "DATABASE":
      // Solid board with a clean white stroked database cylinder (classic
      // stacked-disk glyph), drawn like Lucide for crisp legibility at any size.
      return (
        <>
          <rect x="8" y="4" width="32" height="40" rx="5" fill={p.accent} />
          <g
            fill="none"
            stroke="#ffffff"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="24" cy="15" rx="10" ry="3.6" />
            <path d="M14 15 v18 a10 3.6 0 0 0 20 0 v-18" />
            <path d="M14 24 a10 3.6 0 0 0 20 0" />
          </g>
        </>
      );
    case "FLOWCHART":
      // Solid board with two white nodes joined by a connector.
      return (
        <>
          <rect x="8" y="4" width="32" height="40" rx="5" fill={p.accent} />
          <rect x="13" y="11" width="14" height="8" rx="2" fill="#ffffff" />
          <rect x="23" y="29" width="14" height="8" rx="2" fill="#ffffff" />
          <path
            d="M20 19 V24 a2 2 0 0 0 2 2 H30 V29"
            stroke="#ffffff"
            strokeWidth={2}
            fill="none"
          />
        </>
      );
    default:
      return null;
  }
}

export function getDocumentIcon(type: string): LucideIcon {
  switch (type) {
    case "PDF":
      return FileType;
    case "CODE":
      return FileCode;
    case "SLIDES":
      return File;
    case "DECK":
      return DeckIcon;
    case "WHITEBOARD":
      return BoardGlyph;
    case "DATABASE":
      return DatabaseGlyph;
    case "FLOWCHART":
      return FlowGlyph;
    case "PAGE":
      return PageGlyph;
    case "DOC":
      return FileText;
    case "NOTE":
      return StickyNote;
    case "IMAGE":
      return FileImage;
    case "SHEET":
      return FileSpreadsheet;
    case "ARCHIVE":
      return FileArchive;
    case "AUDIO":
      return FileAudio;
    case "VIDEO":
      return FileVideo;
    default:
      return File;
  }
}

export function getDocumentIconClass(type: string): string {
  switch (type) {
    case "PDF":
      return "text-red-400";
    case "CODE":
      return "text-emerald-400";
    case "SLIDES":
      return "text-orange-400";
    case "DECK":
      return "text-orange-500";
    case "WHITEBOARD":
      return "text-indigo-400";
    case "DATABASE":
      return "text-teal-400";
    case "FLOWCHART":
      return "text-rose-400";
    case "DOC":
      return "text-blue-400";
    case "NOTE":
      return "text-yellow-400";
    case "IMAGE":
      return "text-blue-400";
    case "SHEET":
      return "text-green-400";
    case "ARCHIVE":
      return "text-amber-400";
    case "AUDIO":
      return "text-pink-400";
    case "VIDEO":
      return "text-sky-400";
    default:
      return "text-muted-foreground";
  }
}

/** Soft tinted tile (background + foreground) for OneDrive-style icon chips. */
export function getDocumentTileClass(type: string): string {
  switch (type) {
    case "PDF":
      return "bg-red-500/10 text-red-500 dark:text-red-400";
    case "CODE":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "SLIDES":
    case "DECK":
      return "bg-orange-500/10 text-orange-500 dark:text-orange-400";
    case "WHITEBOARD":
      return "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400";
    case "DATABASE":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400";
    case "FLOWCHART":
      return "bg-rose-500/10 text-rose-500 dark:text-rose-400";
    case "PAGE":
      return "bg-blue-500/10 text-blue-500 dark:text-blue-400";
    case "DOC":
      return "bg-blue-500/10 text-blue-500 dark:text-blue-400";
    case "NOTE":
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500";
    case "IMAGE":
      return "bg-blue-500/10 text-blue-500 dark:text-blue-400";
    case "SHEET":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "ARCHIVE":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "AUDIO":
      return "bg-pink-500/10 text-pink-500 dark:text-pink-400";
    case "VIDEO":
      return "bg-sky-500/10 text-sky-500 dark:text-sky-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Human-friendly label for a document type, used in badges. */
export function getDocumentLabel(type: string): string {
  switch (type) {
    case "PDF":
      return "PDF";
    case "CODE":
      return "Code";
    case "SLIDES":
      return "Slides";
    case "DECK":
      return "Deck";
    case "WHITEBOARD":
      return "Whiteboard";
    case "DATABASE":
      return "Database";
    case "FLOWCHART":
      return "Flowchart";
    case "DOC":
      return "Document";
    case "NOTE":
      return "Note";
    case "IMAGE":
      return "Image";
    case "SHEET":
      return "Spreadsheet";
    case "ARCHIVE":
      return "Archive";
    case "AUDIO":
      return "Audio";
    case "VIDEO":
      return "Video";
    default:
      return "File";
  }
}

/**
 * Files that have no meaningful extracted-text view and are better shown in a
 * Dropbox-style preview panel (media + download) than the document text page.
 */
const PREVIEW_ONLY_TYPES = new Set(["IMAGE", "AUDIO", "VIDEO", "ARCHIVE", "OTHER"]);

export function isPreviewOnlyType(type: string): boolean {
  return PREVIEW_ONLY_TYPES.has(type);
}

export { PageGlyph as PageIcon, FileImage };

/** Short uppercase badge text shown on the illustrative file artwork. */
export function getDocumentBadge(type: string): string {
  switch (type) {
    case "PDF":
      return "PDF";
    case "DOC":
      return "DOC";
    case "SLIDES":
      return "PPT";
    case "DECK":
      return "DECK";
    case "WHITEBOARD":
      return "BOARD";
    case "DATABASE":
      return "DB";
    case "FLOWCHART":
      return "FLOW";
    case "CODE":
      return "CODE";
    case "NOTE":
      return "NOTE";
    case "PAGE":
      return "PAGE";
    case "IMAGE":
      return "IMG";
    case "SHEET":
      return "XLS";
    case "ARCHIVE":
      return "ZIP";
    case "AUDIO":
      return "AUD";
    case "VIDEO":
      return "VID";
    default:
      return "FILE";
  }
}

type ArtPalette = { accent: string; body: string; fold: string; line: string };

const FILE_ART: Record<string, ArtPalette> = {
  PDF: { accent: "#ef4444", body: "#fff1f1", fold: "#fecaca", line: "#fca5a5" },
  DOC: { accent: "#3b82f6", body: "#eff4ff", fold: "#bfdbfe", line: "#93c5fd" },
  SLIDES: { accent: "#f97316", body: "#fff5ec", fold: "#fed7aa", line: "#fdba74" },
  DECK: { accent: "#f97316", body: "#fff5ec", fold: "#fed7aa", line: "#fdba74" },
  WHITEBOARD: { accent: "#6366f1", body: "#eef2ff", fold: "#c7d2fe", line: "#a5b4fc" },
  DATABASE: { accent: "#0d9488", body: "#f0fdfa", fold: "#99f6e4", line: "#5eead4" },
  FLOWCHART: { accent: "#f43f5e", body: "#fff1f3", fold: "#fecdd3", line: "#fda4af" },
  CODE: { accent: "#10b981", body: "#ecfdf5", fold: "#a7f3d0", line: "#6ee7b7" },
  NOTE: { accent: "#f59e0b", body: "#fffbeb", fold: "#fde68a", line: "#fcd34d" },
  PAGE: { accent: "#3b82f6", body: "#eff4ff", fold: "#bfdbfe", line: "#93c5fd" },
  IMAGE: { accent: "#3b82f6", body: "#eff4ff", fold: "#bfdbfe", line: "#93c5fd" },
  SHEET: { accent: "#16a34a", body: "#f0fdf4", fold: "#bbf7d0", line: "#86efac" },
  ARCHIVE: { accent: "#d97706", body: "#fffbeb", fold: "#fde68a", line: "#fcd34d" },
  AUDIO: { accent: "#ec4899", body: "#fdf2f8", fold: "#fbcfe8", line: "#f9a8d4" },
  VIDEO: { accent: "#0ea5e9", body: "#f0f9ff", fold: "#bae6fd", line: "#7dd3fc" },
  OTHER: { accent: "#64748b", body: "#f1f5f9", fold: "#cbd5e1", line: "#94a3b8" },
};

function artPalette(type: string): ArtPalette {
  return FILE_ART[type] ?? FILE_ART.OTHER;
}

/**
 * Large illustrative file glyph (Dropbox / OneDrive style): a document with a
 * folded corner, faint content lines, and a colored extension badge.
 */
export function FileArtwork({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const p = artPalette(type);

  // Native, app-authored types (decks / pages / boards) get bespoke illustrative
  // artwork instead of the generic file-with-badge glyph.
  const native = nativeArtwork(type, p);
  if (native) {
    return (
      <svg
        viewBox="0 0 48 48"
        className={cn("shrink-0", className)}
        role="img"
        aria-hidden
      >
        {native}
      </svg>
    );
  }

  const badge = getDocumentBadge(type);
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      role="img"
      aria-hidden
    >
      <path
        d="M14 4 H30 L40 14 V40 a4 4 0 0 1 -4 4 H12 a4 4 0 0 1 -4 -4 V8 a4 4 0 0 1 4 -4 Z"
        fill={p.body}
        stroke={p.accent}
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />
      <path d="M30 4 L40 14 H30 Z" fill={p.fold} />
      <rect x="13" y="18.5" width="15" height="2.4" rx="1.2" fill={p.line} />
      <rect x="13" y="24" width="11" height="2.4" rx="1.2" fill={p.line} />
      <rect x="11" y="31" width="26" height="11" rx="2.6" fill={p.accent} />
      <text
        x="24"
        y="38.7"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        letterSpacing="0.4"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill="#ffffff"
      >
        {badge}
      </text>
    </svg>
  );
}

/** Large two-tone folder glyph tinted with the folder's color. */
export function FolderArtwork({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  const hex = getFolderColorHex(color);
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("shrink-0", className)}
      role="img"
      aria-hidden
    >
      <path
        d="M5 11 a3 3 0 0 1 3 -3 h9.2 a3 3 0 0 1 2.1 .9 l2.6 2.6 a3 3 0 0 0 2.1 .9 H40 a3 3 0 0 1 3 3 v4 H5 Z"
        fill={hex}
        fillOpacity={0.5}
      />
      <path
        d="M4 16 a3 3 0 0 1 3 -3 h34 a3 3 0 0 1 3 3 v23 a3 3 0 0 1 -3 3 H7 a3 3 0 0 1 -3 -3 Z"
        fill={hex}
      />
    </svg>
  );
}

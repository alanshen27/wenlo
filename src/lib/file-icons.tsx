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
  Presentation,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { getFolderColorHex } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";

export function getDocumentIcon(type: string): LucideIcon {
  switch (type) {
    case "PDF":
      return FileType;
    case "CODE":
      return FileCode;
    case "SLIDES":
      return Presentation;
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
    case "DOC":
      return "text-blue-400";
    case "NOTE":
      return "text-yellow-400";
    case "IMAGE":
      return "text-violet-400";
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
      return "bg-orange-500/10 text-orange-500 dark:text-orange-400";
    case "DOC":
      return "bg-blue-500/10 text-blue-500 dark:text-blue-400";
    case "NOTE":
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500";
    case "IMAGE":
      return "bg-violet-500/10 text-violet-500 dark:text-violet-400";
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

export { FileText as PageIcon, FileImage };

/** Short uppercase badge text shown on the illustrative file artwork. */
export function getDocumentBadge(type: string): string {
  switch (type) {
    case "PDF":
      return "PDF";
    case "DOC":
      return "DOC";
    case "SLIDES":
      return "PPT";
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
  CODE: { accent: "#10b981", body: "#ecfdf5", fold: "#a7f3d0", line: "#6ee7b7" },
  NOTE: { accent: "#f59e0b", body: "#fffbeb", fold: "#fde68a", line: "#fcd34d" },
  PAGE: { accent: "#8b5cf6", body: "#f5f3ff", fold: "#ddd6fe", line: "#c4b5fd" },
  IMAGE: { accent: "#8b5cf6", body: "#f5f3ff", fold: "#ddd6fe", line: "#c4b5fd" },
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

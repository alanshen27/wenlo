// Registry for the app's native, "open me full screen" content types. Each kind
// powers a Word-style home page (`/<kind>`) and a standalone full-screen editor
// (`/<kind>/<id>`). Keep this module dependency-light (type-only Prisma import)
// so both server route handlers and client components can share it.

import type { DocumentType } from "@/generated/prisma/client";

export type NativeKind =
  | "pages"
  | "decks"
  | "whiteboards"
  | "databases"
  | "flowcharts"
  | "pdfs";

/** Legacy URL/API kind segments kept for redirects and bookmarks. */
export const NATIVE_KIND_ALIASES: Record<string, NativeKind> = {
  docs: "pages",
  slides: "decks",
};

// Where a kind's items live: a dedicated `Page` row, a native `Document`
// (whiteboard/deck/db/flowchart), or an uploaded file `Document`.
export type NativeSource = "page" | "document" | "file";

export type NativeTypeConfig = {
  kind: NativeKind;
  /** URL segment under `/app` — kept equal to `kind`. */
  segment: NativeKind;
  /** Dynamic route param name AND the key the editor view reads via useParams. */
  paramKey: string;
  /** Singular noun, e.g. "Page". */
  label: string;
  /** Plural noun used for home titles + tabs, e.g. "Pages". */
  plural: string;
  /** Label for the "create blank" action. */
  newLabel: string;
  /** Default title used when creating a blank item. */
  defaultTitle: string;
  source: NativeSource;
  /** Document type for document-backed kinds. */
  docType?: DocumentType;
  /** Whether the home page exposes a "create new" action. */
  creatable: boolean;
  /** When set, the home sidebar upload input uses this accept string. */
  uploadAccept?: string;
  /** `FileArtwork`/icon key used to render thumbnails for this kind's items. */
  artworkType: string;
  /** Accent color (hex) for home accents + create card. */
  accent: string;
};

export const NATIVE_TYPES: Record<NativeKind, NativeTypeConfig> = {
  pages: {
    kind: "pages",
    segment: "pages",
    paramKey: "pageId",
    label: "Page",
    plural: "Pages",
    newLabel: "Blank page",
    defaultTitle: "Untitled",
    source: "page",
    creatable: true,
    artworkType: "PAGE",
    accent: "#2563eb",
  },
  decks: {
    kind: "decks",
    segment: "decks",
    paramKey: "deckId",
    label: "Deck",
    plural: "Decks",
    newLabel: "Blank deck",
    defaultTitle: "Untitled deck",
    source: "document",
    docType: "DECK",
    creatable: true,
    artworkType: "DECK",
    accent: "#ea580c",
  },
  whiteboards: {
    kind: "whiteboards",
    segment: "whiteboards",
    paramKey: "boardId",
    label: "Whiteboard",
    plural: "Whiteboards",
    newLabel: "Blank whiteboard",
    defaultTitle: "Untitled whiteboard",
    source: "document",
    docType: "WHITEBOARD",
    creatable: true,
    artworkType: "WHITEBOARD",
    accent: "#0d9488",
  },
  databases: {
    kind: "databases",
    segment: "databases",
    paramKey: "databaseId",
    label: "Database",
    plural: "Databases",
    newLabel: "Blank database",
    defaultTitle: "Untitled database",
    source: "document",
    docType: "DATABASE",
    creatable: true,
    artworkType: "DATABASE",
    accent: "#7c3aed",
  },
  flowcharts: {
    kind: "flowcharts",
    segment: "flowcharts",
    paramKey: "flowchartId",
    label: "Flowchart",
    plural: "Flowcharts",
    newLabel: "Blank flowchart",
    defaultTitle: "Untitled flowchart",
    source: "document",
    docType: "FLOWCHART",
    creatable: true,
    artworkType: "FLOWCHART",
    accent: "#db2777",
  },
  pdfs: {
    kind: "pdfs",
    segment: "pdfs",
    paramKey: "pdfId",
    label: "PDF",
    plural: "PDFs",
    newLabel: "Upload PDF",
    defaultTitle: "Untitled PDF",
    source: "file",
    docType: "PDF",
    creatable: false,
    uploadAccept: "application/pdf,.pdf",
    artworkType: "PDF",
    accent: "#dc2626",
  },
};

/** Launcher display order. */
export const NATIVE_KIND_ORDER: NativeKind[] = [
  "pages",
  "decks",
  "whiteboards",
  "databases",
  "flowcharts",
  "pdfs",
];

/** Native document types (everything else counts as an uploaded "file"). */
export const NATIVE_DOC_TYPES: DocumentType[] = [
  "WHITEBOARD",
  "DECK",
  "DATABASE",
  "FLOWCHART",
];

export function isNativeKind(value: string): value is NativeKind {
  return value in NATIVE_TYPES;
}

export function resolveNativeKind(value: string): NativeKind | null {
  if (isNativeKind(value)) return value;
  return NATIVE_KIND_ALIASES[value] ?? null;
}

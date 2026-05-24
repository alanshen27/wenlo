import {
  File,
  FileCode,
  FileImage,
  FileText,
  FileType,
  Presentation,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

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
    default:
      return "text-muted-foreground";
  }
}

export { FileText as PageIcon, FileImage };

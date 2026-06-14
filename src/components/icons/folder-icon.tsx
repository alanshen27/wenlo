import { Folder } from "lucide-react";
import { getFolderColorHex } from "@/lib/library/folder-colors";

type Props = {
  color: string;
  className?: string;
};

export function FolderIcon({ color, className = "h-4 w-4 shrink-0" }: Props) {
  const hex = getFolderColorHex(color);
  return (
    <Folder className={className} style={{ color: hex, fill: `${hex}33` }} aria-hidden />
  );
}

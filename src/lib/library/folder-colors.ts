export const FOLDER_COLORS = [
  { id: "gray", label: "Gray", hex: "#9b9b9b" },
  { id: "brown", label: "Brown", hex: "#a2774a" },
  { id: "orange", label: "Orange", hex: "#d9730d" },
  { id: "yellow", label: "Yellow", hex: "#cb912f" },
  { id: "green", label: "Green", hex: "#448361" },
  { id: "blue", label: "Blue", hex: "#337ea9" },
  { id: "purple", label: "Purple", hex: "#9065b0" },
  { id: "pink", label: "Pink", hex: "#c14c8a" },
  { id: "red", label: "Red", hex: "#d44c47" },
] as const;

export type FolderColorId = (typeof FOLDER_COLORS)[number]["id"];

export function getFolderColorHex(colorId: string | null | undefined): string {
  return FOLDER_COLORS.find((c) => c.id === colorId)?.hex ?? FOLDER_COLORS[0].hex;
}

export const LIBRARY_ICONS = ["📚", "🧠", "💻", "🔬", "📐", "🏆", "📝", "🎯", "⚡", "🌐"] as const;

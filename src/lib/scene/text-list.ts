export type TextListStyle = "none" | "bullet";

export const BULLET_CHAR = "•";
const BULLET_PREFIX_RE = /^•\s?/;

/** Gutter width for bullet column (scene units). */
export function bulletGutter(fontSize: number): number {
  return fontSize * 1.1;
}

export function splitTextLines(text: string): string[] {
  const lines = text.split("\n");
  return lines.length ? lines : [""];
}

/** Plain stored text → textarea value while editing a bulleted box. */
export function formatTextForEdit(text: string, listStyle?: TextListStyle): string {
  if (listStyle !== "bullet") return text;
  const lines = splitTextLines(text);
  return lines.map((line) => `${BULLET_CHAR} ${line}`).join("\n");
}

/** Textarea value → plain stored text for a bulleted box. */
export function parseTextFromEdit(text: string, listStyle?: TextListStyle): string {
  if (listStyle !== "bullet") return text;
  return splitTextLines(text)
    .map((line) => line.replace(BULLET_PREFIX_RE, ""))
    .join("\n");
}

/** Prefix each line with a bullet for single-block Konva/SVG rendering. */
export function textWithBulletPrefixes(text: string): string {
  return splitTextLines(text)
    .map((line) => `${BULLET_CHAR} ${line}`)
    .join("\n");
}

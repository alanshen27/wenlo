/**
 * Targeted string-replacement patches for text documents.
 *
 * Agents edit notes by choosing a substring to replace and which occurrence to
 * hit (1-based index, or "all"), rather than rewriting the whole document. This
 * keeps the document id stable and the agent payload small. See
 * docs/prd-mcp-write-tools.md.
 */

/** Which match(es) of `oldString` to replace. 1 = first, 2 = second, … or "all". */
export type Occurrence = number | "all";

export class TextPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TextPatchError";
  }
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    count += 1;
    pos = idx + needle.length;
  }
  return count;
}

/** Index of the nth (1-based) non-overlapping occurrence, or -1 if absent. */
function indexOfNth(haystack: string, needle: string, n: number): number {
  let pos = 0;
  let found = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) return -1;
    found += 1;
    if (found === n) return idx;
    pos = idx + needle.length;
  }
}

export interface TextPatchResult {
  content: string;
  /** How many replacements were applied. */
  replaced: number;
}

/**
 * Replace `oldString` with `newString` in `content`.
 *
 * - `occurrence` defaults to 1 (first match only).
 * - A numeric `occurrence` greater than the number of matches throws.
 * - `oldString` must be non-empty and must be present at least once.
 */
export function applyTextPatch(
  content: string,
  oldString: string,
  newString: string,
  occurrence: Occurrence = 1
): TextPatchResult {
  if (oldString === "") {
    throw new TextPatchError("oldString must not be empty.");
  }

  const matches = countOccurrences(content, oldString);
  if (matches === 0) {
    throw new TextPatchError("oldString was not found in the document.");
  }

  if (occurrence === "all") {
    return { content: content.split(oldString).join(newString), replaced: matches };
  }

  if (!Number.isInteger(occurrence) || occurrence < 1) {
    throw new TextPatchError('occurrence must be a positive integer or "all".');
  }

  if (occurrence > matches) {
    throw new TextPatchError(
      `Requested occurrence ${occurrence} but only ${matches} match(es) were found. ` +
        `Use a more specific oldString or a valid index.`
    );
  }

  const at = indexOfNth(content, oldString, occurrence);
  const patched = content.slice(0, at) + newString + content.slice(at + oldString.length);
  return { content: patched, replaced: 1 };
}

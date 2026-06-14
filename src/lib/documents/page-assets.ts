const PAGE_ASSET_PREFIX = "/api/pages/";

export function pageAssetUrl(pageId: string, filename: string) {
  return `${PAGE_ASSET_PREFIX}${pageId}/assets/${encodeURIComponent(filename)}`;
}

export function pageAssetStoragePath(userId: string, pageId: string, filename: string) {
  return `${userId}/pages/${pageId}/${filename}`;
}

export function parsePageAssetRequest(pageId: string, pathSegments: string[]) {
  const filename = pathSegments.map(decodeURIComponent).join("/");
  if (!filename || filename.includes("..")) return null;
  return filename;
}

export function isPageAssetUrl(url: string, pageId: string) {
  return url.startsWith(`${PAGE_ASSET_PREFIX}${pageId}/assets/`);
}

export const PAGE_ASSET_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Script/markup types that could execute in the browser when served from our
 * own origin — never accept these, even though everything else is allowed.
 */
const BLOCKED_ASSET_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-msdos-program",
]);

/** Generous allowlist: any non-executable file type can be embedded in a page. */
export function isAllowedAssetType(mime: string): boolean {
  if (!mime) return true; // unknown / octet-stream — served as a download
  return !BLOCKED_ASSET_MIME_TYPES.has(mime.toLowerCase());
}

/**
 * Only real media is served inline (so it renders in the editor block); every
 * other type is sent as an attachment to neutralize any markup/XSS risk.
 */
export function isInlineAssetType(mime: string): boolean {
  const value = mime.toLowerCase();
  return (
    value.startsWith("image/") ||
    value.startsWith("video/") ||
    value.startsWith("audio/") ||
    value === "application/pdf"
  );
}

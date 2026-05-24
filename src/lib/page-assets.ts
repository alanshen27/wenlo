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

export const PAGE_ASSET_MAX_BYTES = 10 * 1024 * 1024;

export const PAGE_ASSET_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

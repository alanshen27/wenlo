export const USAGE_UPDATED_EVENT = "wenlo:usage-updated";

export function notifyUsageUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(USAGE_UPDATED_EVENT));
  }
}

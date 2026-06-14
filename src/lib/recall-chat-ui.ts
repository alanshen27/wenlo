import type { RecallChatSessionSummary } from "@/lib/recall-chat-shared";

export function formatSessionWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function sessionLabel(session: RecallChatSessionSummary) {
  if (session.title) return session.title;
  if (session.turnCount > 0) return "Untitled chat";
  return "New chat";
}

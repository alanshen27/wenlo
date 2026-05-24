export type RecallResult = {
  id: string;
  sourceType: "page" | "document";
  title: string;
  snippet: string;
  /** Longer passage sent to the LLM (UI uses snippet). */
  excerpt?: string;
  score: number;
  folderId: string | null;
  matchType: "keyword" | "semantic" | "both";
};

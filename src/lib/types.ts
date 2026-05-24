export type RecallResult = {
  id: string;
  sourceType: "page" | "document";
  title: string;
  snippet: string;
  score: number;
  folderId: string | null;
  matchType: "keyword" | "semantic" | "both";
};

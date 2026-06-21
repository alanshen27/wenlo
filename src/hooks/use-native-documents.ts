"use client";

import { useDocumentQuery } from "@/hooks/use-document-query";
import { queryKeys } from "@/lib/client/query-keys";
import {
  boardRoute,
  databaseRoute,
  deckRoute,
  flowchartRoute,
  libraryHome,
  pageRoute,
} from "@/lib/client/routes";

type PageDoc = {
  id: string;
  title: string;
  content: unknown;
  folderId: string | null;
  libraryId: string;
  updatedAt: string;
};

type DeckDoc = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  deck: unknown;
};

type BoardDoc = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  scene: unknown;
};

type FlowchartDoc = {
  id: string;
  title: string;
  folderId: string | null;
  libraryId: string;
  scene: unknown;
};

export function usePageDocument(pageId: string, libraryId: string) {
  return useDocumentQuery<PageDoc>({
    id: pageId,
    libraryId,
    queryKey: queryKeys.page(pageId),
    path: `/api/pages/${pageId}`,
    homeRoute: libraryHome,
    itemRoute: pageRoute,
    errorMessage: "We couldn't load this page.",
  });
}

export function useDeckDocument(deckId: string, libraryId: string) {
  return useDocumentQuery<DeckDoc>({
    id: deckId,
    libraryId,
    queryKey: queryKeys.deck(deckId),
    path: `/api/decks/${deckId}`,
    homeRoute: libraryHome,
    itemRoute: deckRoute,
    errorMessage: "We couldn't load this deck.",
  });
}

export function useBoardDocument(boardId: string, libraryId: string) {
  return useDocumentQuery<BoardDoc>({
    id: boardId,
    libraryId,
    queryKey: queryKeys.board(boardId),
    path: `/api/boards/${boardId}`,
    homeRoute: libraryHome,
    itemRoute: boardRoute,
    errorMessage: "We couldn't load this whiteboard.",
  });
}

export function useFlowchartDocument(flowchartId: string, libraryId: string) {
  return useDocumentQuery<FlowchartDoc>({
    id: flowchartId,
    libraryId,
    queryKey: queryKeys.flowchart(flowchartId),
    path: `/api/flowcharts/${flowchartId}`,
    homeRoute: libraryHome,
    itemRoute: flowchartRoute,
    errorMessage: "We couldn't load this flowchart.",
  });
}

export function useDatabaseDocument(databaseId: string, libraryId: string) {
  return useDocumentQuery<import("@/lib/databases/database-schema").DatabaseScene>({
    id: databaseId,
    libraryId,
    queryKey: queryKeys.database(databaseId),
    path: `/api/databases/${databaseId}`,
    homeRoute: libraryHome,
    itemRoute: databaseRoute,
    errorMessage: "We couldn't load this database.",
  });
}

export type { PageDoc, DeckDoc, BoardDoc, FlowchartDoc };

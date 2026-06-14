import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveGatewayFolderId } from "@/lib/auth/gateway-auth";
import { authorizeLibrary, getMcpAuthExtra, verifyRecallApiKey } from "@/lib/auth/mcp-auth";
import { prisma } from "@/lib/db/prisma";
import { applyTextPatch } from "@/lib/documents/text-patch";
import { contentOwnerId, requireLibraryAccess } from "@/lib/library/library-access";
import { indexDocument, recallSearch } from "@/lib/search/search";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** Hard cap on inline base64 file downloads to avoid blowing up model context. */
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function toAuth(extra: { authInfo?: unknown }) {
  return getMcpAuthExtra(extra.authInfo as Parameters<typeof getMcpAuthExtra>[0]);
}

const baseHandler = createMcpHandler(
  (server: McpServer) => {
    server.registerTool(
      "list_libraries",
      {
        title: "List libraries",
        description:
          "List the wenlo libraries this API key can access. Use the returned `id` as `libraryId` for the other tools.",
        inputSchema: {},
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (_args, extra) => {
        try {
          const auth = toAuth(extra);
          const libraries = await prisma.library.findMany({
            where: {
              ...(auth.scopedLibraryId ? { id: auth.scopedLibraryId } : {}),
              OR: [{ userId: auth.userId }, { members: { some: { userId: auth.userId } } }],
            },
            select: { id: true, name: true, icon: true, updatedAt: true },
            orderBy: { createdAt: "asc" },
          });
          return jsonResult({ libraries });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Failed to list libraries");
        }
      }
    );

    server.registerTool(
      "search_library",
      {
        title: "Search library",
        description:
          "Semantic + keyword search across documents and pages in a library. Returns ranked snippets with source ids.",
        inputSchema: {
          libraryId: z.string().describe("Library id to search within"),
          query: z.string().describe("Natural language or keyword query"),
          folderId: z
            .string()
            .optional()
            .describe("Restrict to a folder id (omit or 'root' for the whole library)"),
          limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ libraryId, query, folderId, limit }, extra) => {
        try {
          const auth = toAuth(extra);
          await authorizeLibrary(auth, libraryId);
          const resolvedFolderId =
            folderId === undefined
              ? null
              : await resolveGatewayFolderId(auth.userId, libraryId, folderId);
          const results = await recallSearch({
            userId: auth.userId,
            libraryId,
            folderId: resolvedFolderId,
            query,
            limit: Math.min(limit ?? 20, 50),
          });
          return jsonResult({ query, count: results.length, results });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Search failed");
        }
      }
    );

    server.registerTool(
      "list_documents",
      {
        title: "List documents",
        description:
          "List documents in a library (optionally within a folder), returning metadata for each. Use `get_document` for text or `download_file` for the original bytes.",
        inputSchema: {
          libraryId: z.string().describe("Library id"),
          folderId: z
            .string()
            .optional()
            .describe("Folder id to list (omit or 'root' for the library root)"),
          limit: z.number().int().min(1).max(200).optional().describe("Max documents (default 50)"),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ libraryId, folderId, limit }, extra) => {
        try {
          const auth = toAuth(extra);
          await authorizeLibrary(auth, libraryId);
          const folderFilter =
            folderId === undefined
              ? {}
              : { folderId: await resolveGatewayFolderId(auth.userId, libraryId, folderId) };
          const documents = await prisma.document.findMany({
            where: { userId: auth.userId, libraryId, ...folderFilter },
            orderBy: { updatedAt: "desc" },
            take: Math.min(limit ?? 50, 200),
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              mimeType: true,
              sizeBytes: true,
              folderId: true,
              updatedAt: true,
            },
          });
          return jsonResult({ count: documents.length, documents });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Failed to list documents");
        }
      }
    );

    server.registerTool(
      "get_document",
      {
        title: "Get document text",
        description:
          "Fetch a single document's metadata and extracted text content. Best for letting the model read a file.",
        inputSchema: {
          libraryId: z.string().describe("Library id the document belongs to"),
          documentId: z.string().describe("Document id"),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ libraryId, documentId }, extra) => {
        try {
          const auth = toAuth(extra);
          await authorizeLibrary(auth, libraryId);
          const document = await prisma.document.findFirst({
            where: { id: documentId, userId: auth.userId, libraryId },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              mimeType: true,
              sizeBytes: true,
              language: true,
              folderId: true,
              content: true,
              updatedAt: true,
            },
          });
          if (!document) return errorResult("Document not found");
          return jsonResult(document);
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Failed to get document");
        }
      }
    );

    server.registerTool(
      "download_file",
      {
        title: "Download file",
        description:
          "Download the original uploaded file as a base64 blob (capped at 8 MB). Images are returned as image content; other types as an embedded resource. For large or text-heavy files prefer `get_document`.",
        inputSchema: {
          libraryId: z.string().describe("Library id the document belongs to"),
          documentId: z.string().describe("Document id to download"),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ libraryId, documentId }, extra) => {
        try {
          const auth = toAuth(extra);
          await authorizeLibrary(auth, libraryId);
          const document = await prisma.document.findFirst({
            where: { id: documentId, userId: auth.userId, libraryId },
            select: { id: true, title: true, mimeType: true, storagePath: true },
          });
          if (!document) return errorResult("Document not found");
          if (!document.storagePath) {
            return errorResult("This document has no stored file (text-only). Use get_document.");
          }

          const supabase = createAdminClient();
          const { data, error } = await supabase.storage
            .from("documents")
            .download(document.storagePath);
          if (error || !data) return errorResult("File could not be retrieved from storage");

          const arrayBuffer = await data.arrayBuffer();
          if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
            return errorResult(
              `File is ${arrayBuffer.byteLength} bytes which exceeds the ${MAX_DOWNLOAD_BYTES} byte inline limit. Use get_document for the extracted text.`
            );
          }

          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = document.mimeType || data.type || "application/octet-stream";
          const summary = {
            id: document.id,
            title: document.title,
            mimeType,
            sizeBytes: arrayBuffer.byteLength,
            encoding: "base64",
          };

          if (mimeType.startsWith("image/")) {
            return {
              content: [
                { type: "text", text: JSON.stringify(summary, null, 2) },
                { type: "image", data: base64, mimeType },
              ],
            };
          }

          return {
            content: [
              { type: "text", text: JSON.stringify(summary, null, 2) },
              {
                type: "resource",
                resource: {
                  uri: `recall://documents/${document.id}`,
                  mimeType,
                  blob: base64,
                },
              },
            ],
          };
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Failed to download file");
        }
      }
    );

    server.registerTool(
      "create_note",
      {
        title: "Create note",
        description:
          "Create a new text note in a library and return its id. The note is immediately searchable. Use `append_to_note` to add to it or `edit_note` to patch it later.",
        inputSchema: {
          libraryId: z.string().describe("Library id to create the note in (requires EDITOR access)"),
          title: z.string().describe("Note title"),
          content: z.string().optional().describe("Initial body text (plain text/markdown)"),
          folderId: z
            .string()
            .optional()
            .describe("Folder id to place the note in (omit or 'root' for the library root)"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      async ({ libraryId, title, content, folderId }, extra) => {
        try {
          const auth = toAuth(extra);
          await authorizeLibrary(auth, libraryId);
          await requireLibraryAccess(auth.userId, libraryId, "EDITOR");

          const ownerId = await contentOwnerId(libraryId);
          const resolvedFolderId =
            folderId === undefined
              ? null
              : await resolveGatewayFolderId(auth.userId, libraryId, folderId);
          const body = (content ?? "").trim();

          const document = await prisma.document.create({
            data: {
              title: title.trim() || "Untitled note",
              type: "NOTE",
              status: "READY",
              content: body,
              userId: ownerId,
              libraryId,
              folderId: resolvedFolderId,
            },
            select: { id: true, title: true, folderId: true },
          });

          if (body) await indexDocument(document.id, document.title, body);

          return jsonResult({
            id: document.id,
            title: document.title,
            libraryId,
            folderId: document.folderId,
          });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Failed to create note");
        }
      }
    );

    server.registerTool(
      "append_to_note",
      {
        title: "Append to note",
        description:
          "Append text to the end of an existing text note. Only works on native notes (not uploaded files).",
        inputSchema: {
          libraryId: z.string().describe("Library id the note belongs to (requires EDITOR access)"),
          documentId: z.string().describe("Document id of the note to append to"),
          text: z.string().describe("Text to append. A blank line is inserted before it if the note is non-empty."),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      async ({ libraryId, documentId, text }, extra) => {
        try {
          const auth = toAuth(extra);
          await authorizeLibrary(auth, libraryId);
          await requireLibraryAccess(auth.userId, libraryId, "EDITOR");

          const document = await prisma.document.findFirst({
            where: { id: documentId, libraryId },
            select: { id: true, title: true, content: true, storagePath: true },
          });
          if (!document) return errorResult("Document not found");
          if (document.storagePath) {
            return errorResult(
              "This document is an uploaded file; its extracted text can't be edited. Use create_note for editable notes."
            );
          }

          const existing = document.content ?? "";
          const next = existing.length > 0 ? `${existing}\n\n${text}` : text;
          await prisma.document.update({ where: { id: document.id }, data: { content: next } });
          await indexDocument(document.id, document.title, next);

          return jsonResult({ id: document.id, length: next.length });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Failed to append to note");
        }
      }
    );

    server.registerTool(
      "edit_note",
      {
        title: "Edit note (patch)",
        description:
          "Patch a note by replacing a substring rather than rewriting it. Choose which occurrence to replace via `occurrence`. Only works on native notes (not uploaded files).",
        inputSchema: {
          libraryId: z.string().describe("Library id the note belongs to (requires EDITOR access)"),
          documentId: z.string().describe("Document id of the note to edit"),
          oldString: z.string().min(1).describe("Exact substring to find and replace (must be non-empty)"),
          newString: z.string().describe("Replacement text (may be empty to delete the match)"),
          occurrence: z
            .union([z.number().int().min(1), z.literal("all")])
            .optional()
            .describe(
              "Which match to replace: 1 = first (default), 2 = second, 3 = third, …, or 'all' for every occurrence"
            ),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      },
      async ({ libraryId, documentId, oldString, newString, occurrence }, extra) => {
        try {
          const auth = toAuth(extra);
          await authorizeLibrary(auth, libraryId);
          await requireLibraryAccess(auth.userId, libraryId, "EDITOR");

          const document = await prisma.document.findFirst({
            where: { id: documentId, libraryId },
            select: { id: true, title: true, content: true, storagePath: true },
          });
          if (!document) return errorResult("Document not found");
          if (document.storagePath) {
            return errorResult(
              "This document is an uploaded file; its extracted text can't be edited. Use create_note for editable notes."
            );
          }

          const { content: next, replaced } = applyTextPatch(
            document.content ?? "",
            oldString,
            newString,
            occurrence ?? 1
          );
          await prisma.document.update({ where: { id: document.id }, data: { content: next } });
          await indexDocument(document.id, document.title, next);

          return jsonResult({ id: document.id, replaced, length: next.length });
        } catch (error) {
          return errorResult(error instanceof Error ? error.message : "Failed to edit note");
        }
      }
    );
  },
  {
    serverInfo: { name: "recall", version: "1.0.0" },
  },
  {
    // Route lives at /api/[transport] → streamable HTTP endpoint is /api/mcp.
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  }
);

const handler = withMcpAuth(baseHandler, verifyRecallApiKey, { required: true });

export { handler as GET, handler as POST, handler as DELETE };

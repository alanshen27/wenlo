import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getMcpAuthExtra, verifyRecallApiKey } from "@/lib/auth/mcp-auth";
import {
  buildMcpDownloadResult,
  executeRecallTool,
  recallToolContextFromMcp,
} from "@/lib/recall-chat/recall-tools";

export const maxDuration = 60;

function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function toAuth(extra: { authInfo?: unknown }) {
  return getMcpAuthExtra(extra.authInfo as Parameters<typeof getMcpAuthExtra>[0]);
}

async function runTool(
  name: string,
  args: unknown,
  extra: { authInfo?: unknown }
): Promise<CallToolResult> {
  try {
    const auth = toAuth(extra);
    const ctx = recallToolContextFromMcp(auth);
    if (name === "download_file") {
      return buildMcpDownloadResult(args, ctx);
    }
    const outcome = await executeRecallTool(name, args, ctx);
    if (outcome.isError) return errorResult(String(outcome.result));
    return jsonResult(outcome.result);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : "Tool failed");
  }
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
      async (_args, extra) => runTool("list_libraries", {}, extra)
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
      async (args, extra) => runTool("search_library", args, extra)
    );

    server.registerTool(
      "grep_library",
      {
        title: "Grep library",
        description:
          "Exact literal or regex grep across page and note text. Returns line numbers and surrounding context. Best for precise strings, identifiers, and code symbols.",
        inputSchema: {
          libraryId: z.string().describe("Library id to search within"),
          pattern: z.string().min(1).describe("Literal text or regex pattern to find"),
          folderId: z
            .string()
            .optional()
            .describe("Restrict to a folder id (omit or 'root' for the whole library)"),
          caseSensitive: z.boolean().optional().describe("Case-sensitive match (default false)"),
          regex: z.boolean().optional().describe("Treat pattern as a regex (default false)"),
          limit: z.number().int().min(1).max(50).optional().describe("Max files with hits (default 20)"),
          contextLines: z
            .number()
            .int()
            .min(0)
            .max(5)
            .optional()
            .describe("Lines of context before/after each hit (default 1)"),
        },
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (args, extra) => runTool("grep_library", args, extra)
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
      async (args, extra) => runTool("list_documents", args, extra)
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
      async (args, extra) => runTool("get_document", args, extra)
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
      async (args, extra) => runTool("download_file", args, extra)
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
      async (args, extra) => runTool("create_note", args, extra)
    );

    server.registerTool(
      "create_library_item",
      {
        title: "Create library item",
        description:
          "Create a note, page, whiteboard, deck, database, or flowchart in a library (requires EDITOR access).",
        inputSchema: {
          libraryId: z.string().describe("Library id"),
          kind: z
            .enum(["note", "page", "whiteboard", "deck", "database", "flowchart"])
            .describe("Item type to create"),
          title: z.string().optional().describe("Title (default varies by kind)"),
          folderId: z
            .string()
            .optional()
            .describe("Folder id (omit or 'root' for the library root)"),
          content: z
            .string()
            .optional()
            .describe("Plain text body for note or page"),
          databaseTemplate: z
            .enum(["tasks", "contacts", "roadmap"])
            .optional()
            .describe("Starter template when kind is database"),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      async (args, extra) => runTool("create_library_item", args, extra)
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
      async (args, extra) => runTool("append_to_note", args, extra)
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
      async (args, extra) => runTool("edit_note", args, extra)
    );
  },
  {
    serverInfo: { name: "recall", version: "1.0.0" },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  }
);

const handler = withMcpAuth(baseHandler, verifyRecallApiKey, { required: true });

export { handler as GET, handler as POST, handler as DELETE };

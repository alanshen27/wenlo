import { z } from "zod";
import type OpenAI from "openai";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveGatewayFolderId } from "@/lib/auth/gateway-auth";
import type { McpAuthExtra } from "@/lib/auth/mcp-auth";
import { authorizeLibrary } from "@/lib/auth/mcp-auth";
import { prisma } from "@/lib/db/prisma";
import { applyTextPatch } from "@/lib/documents/text-patch";
import { contentOwnerId, requireLibraryAccess } from "@/lib/library/library-access";
import {
  createLibraryItem,
  LIBRARY_ITEM_KINDS,
  type LibraryItemKind,
} from "@/lib/library/create-items";
import { indexDocument, recallSearch } from "@/lib/search/search";
import { grepLibrary } from "@/lib/search/grep";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;

export const RECALL_TOOL_NAMES = [
  "list_libraries",
  "search_library",
  "grep_library",
  "list_documents",
  "get_document",
  "download_file",
  "create_note",
  "create_library_item",
  "append_to_note",
  "edit_note",
] as const;

export type RecallToolName = (typeof RECALL_TOOL_NAMES)[number];

export type RecallToolContext = {
  userId: string;
  scopedLibraryId: string | null;
  /** Omit large binary payloads (chat UI). MCP keeps full payloads. */
  compactResults?: boolean;
};

export type RecallToolOutcome = {
  result: unknown;
  isError: boolean;
};

export function recallToolContextFromMcp(auth: McpAuthExtra): RecallToolContext {
  return { userId: auth.userId, scopedLibraryId: auth.scopedLibraryId, compactResults: false };
}

export function recallToolContextFromUser(
  userId: string,
  options?: { compactResults?: boolean }
): RecallToolContext {
  return { userId, scopedLibraryId: null, compactResults: options?.compactResults ?? true };
}

const searchLibrarySchema = z.object({
  libraryId: z.string(),
  query: z.string(),
  folderId: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
const grepLibrarySchema = z.object({
  libraryId: z.string(),
  pattern: z.string().min(1),
  folderId: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  regex: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  contextLines: z.number().int().min(0).max(5).optional(),
});
const listDocumentsSchema = z.object({
  libraryId: z.string(),
  folderId: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
const documentRefSchema = z.object({
  libraryId: z.string(),
  documentId: z.string(),
});
const createNoteSchema = z.object({
  libraryId: z.string(),
  title: z.string(),
  content: z.string().optional(),
  folderId: z.string().optional(),
});
const createLibraryItemSchema = z.object({
  libraryId: z.string(),
  kind: z.enum(LIBRARY_ITEM_KINDS),
  title: z.string().optional(),
  folderId: z.string().optional(),
  content: z.string().optional().describe("Plain text body for note or page"),
  databaseTemplate: z
    .string()
    .optional()
    .describe("Database starter template: tasks, contacts, or roadmap"),
});
const appendNoteSchema = z.object({
  libraryId: z.string(),
  documentId: z.string(),
  text: z.string(),
});
const editNoteSchema = z.object({
  libraryId: z.string(),
  documentId: z.string(),
  oldString: z.string().min(1),
  newString: z.string(),
  occurrence: z.union([z.number().int().min(1), z.literal("all")]).optional(),
});

const TOOL_SCHEMAS: Record<RecallToolName, z.ZodTypeAny> = {
  list_libraries: z.object({}),
  search_library: searchLibrarySchema,
  grep_library: grepLibrarySchema,
  list_documents: listDocumentsSchema,
  get_document: documentRefSchema,
  download_file: documentRefSchema,
  create_note: createNoteSchema,
  create_library_item: createLibraryItemSchema,
  append_to_note: appendNoteSchema,
  edit_note: editNoteSchema,
};

export async function executeRecallTool(
  name: string,
  args: unknown,
  ctx: RecallToolContext
): Promise<RecallToolOutcome> {
  if (!RECALL_TOOL_NAMES.includes(name as RecallToolName)) {
    return { result: `Unknown tool: ${name}`, isError: true };
  }

  const toolName = name as RecallToolName;
  const parsed = TOOL_SCHEMAS[toolName].safeParse(args);
  if (!parsed.success) {
    return { result: parsed.error.message, isError: true };
  }

  try {
    const result = await runRecallTool(toolName, parsed.data, ctx);
    return { result, isError: false };
  } catch (error) {
    return {
      result: error instanceof Error ? error.message : "Tool execution failed",
      isError: true,
    };
  }
}

async function runRecallTool(
  name: RecallToolName,
  args: unknown,
  ctx: RecallToolContext
): Promise<unknown> {
  switch (name) {
    case "list_libraries":
      return listLibraries(ctx);
    case "search_library":
      return searchLibrary(args as z.infer<typeof searchLibrarySchema>, ctx);
    case "grep_library":
      return grepLibraryTool(args as z.infer<typeof grepLibrarySchema>, ctx);
    case "list_documents":
      return listDocuments(args as z.infer<typeof listDocumentsSchema>, ctx);
    case "get_document":
      return getDocument(args as z.infer<typeof documentRefSchema>, ctx);
    case "download_file":
      return downloadFile(args as z.infer<typeof documentRefSchema>, ctx);
    case "create_note":
      return createNote(args as z.infer<typeof createNoteSchema>, ctx);
    case "create_library_item":
      return createLibraryItemTool(args as z.infer<typeof createLibraryItemSchema>, ctx);
    case "append_to_note":
      return appendNote(args as z.infer<typeof appendNoteSchema>, ctx);
    case "edit_note":
      return editNote(args as z.infer<typeof editNoteSchema>, ctx);
    default:
      throw new Error(`Unhandled tool: ${name}`);
  }
}

async function listLibraries(ctx: RecallToolContext) {
  const libraries = await prisma.library.findMany({
    where: {
      ...(ctx.scopedLibraryId ? { id: ctx.scopedLibraryId } : {}),
      OR: [{ userId: ctx.userId }, { members: { some: { userId: ctx.userId } } }],
    },
    select: { id: true, name: true, icon: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
  });
  return { libraries };
}

async function searchLibrary(
  { libraryId, query, folderId, limit }: z.infer<typeof searchLibrarySchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  const resolvedFolderId =
    folderId === undefined
      ? null
      : await resolveGatewayFolderId(ctx.userId, libraryId, folderId);
  const results = await recallSearch({
    userId: ctx.userId,
    libraryId,
    folderId: resolvedFolderId,
    query,
    limit: Math.min(limit ?? 20, 50),
  });
  return { query, count: results.length, results };
}

async function grepLibraryTool(
  {
    libraryId,
    pattern,
    folderId,
    caseSensitive,
    regex,
    limit,
    contextLines,
  }: z.infer<typeof grepLibrarySchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  const resolvedFolderId =
    folderId === undefined
      ? null
      : await resolveGatewayFolderId(ctx.userId, libraryId, folderId);
  const results = await grepLibrary({
    userId: ctx.userId,
    libraryId,
    folderId: resolvedFolderId,
    pattern,
    caseSensitive,
    regex,
    limit: Math.min(limit ?? 20, 50),
    contextLines,
  });
  return { pattern, count: results.length, results };
}

async function listDocuments(
  { libraryId, folderId, limit }: z.infer<typeof listDocumentsSchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  const folderFilter =
    folderId === undefined
      ? {}
      : { folderId: await resolveGatewayFolderId(ctx.userId, libraryId, folderId) };
  const documents = await prisma.document.findMany({
    where: { userId: ctx.userId, libraryId, ...folderFilter },
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
  return { count: documents.length, documents };
}

async function getDocument(
  { libraryId, documentId }: z.infer<typeof documentRefSchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: ctx.userId, libraryId },
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
  if (!document) throw new Error("Document not found");
  return document;
}

async function downloadFile(
  { libraryId, documentId }: z.infer<typeof documentRefSchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: ctx.userId, libraryId },
    select: { id: true, title: true, mimeType: true, storagePath: true },
  });
  if (!document) throw new Error("Document not found");
  if (!document.storagePath) {
    throw new Error("This document has no stored file (text-only). Use get_document.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("documents").download(document.storagePath);
  if (error || !data) throw new Error("File could not be retrieved from storage");

  const arrayBuffer = await data.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(
      `File is ${arrayBuffer.byteLength} bytes which exceeds the ${MAX_DOWNLOAD_BYTES} byte inline limit. Use get_document for the extracted text.`
    );
  }

  const mimeType = document.mimeType || data.type || "application/octet-stream";
  const summary = {
    id: document.id,
    title: document.title,
    mimeType,
    sizeBytes: arrayBuffer.byteLength,
    encoding: "base64",
  };

  if (ctx.compactResults) {
    return {
      ...summary,
      note: "Binary omitted in chat. Use get_document for extracted text.",
    };
  }

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { ...summary, base64, mimeType };
}

/** MCP-shaped download result (images + embedded resources). */
export async function buildMcpDownloadResult(
  args: unknown,
  ctx: RecallToolContext
): Promise<CallToolResult> {
  const parsed = documentRefSchema.safeParse(args);
  if (!parsed.success) {
    return { content: [{ type: "text", text: parsed.error.message }], isError: true };
  }

  try {
    await authorizeLibrary(
      { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
      parsed.data.libraryId
    );
    const document = await prisma.document.findFirst({
      where: {
        id: parsed.data.documentId,
        userId: ctx.userId,
        libraryId: parsed.data.libraryId,
      },
      select: { id: true, title: true, mimeType: true, storagePath: true },
    });
    if (!document) return { content: [{ type: "text", text: "Document not found" }], isError: true };
    if (!document.storagePath) {
      return {
        content: [
          {
            type: "text",
            text: "This document has no stored file (text-only). Use get_document.",
          },
        ],
        isError: true,
      };
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from("documents")
      .download(document.storagePath);
    if (error || !data) {
      return {
        content: [{ type: "text", text: "File could not be retrieved from storage" }],
        isError: true,
      };
    }

    const arrayBuffer = await data.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
      return {
        content: [
          {
            type: "text",
            text: `File is ${arrayBuffer.byteLength} bytes which exceeds the ${MAX_DOWNLOAD_BYTES} byte inline limit. Use get_document for the extracted text.`,
          },
        ],
        isError: true,
      };
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
            uri: `wenlo://documents/${document.id}`,
            mimeType,
            blob: base64,
          },
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : "Failed to download file",
        },
      ],
      isError: true,
    };
  }
}

async function createNote(
  { libraryId, title, content, folderId }: z.infer<typeof createNoteSchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  const resolvedFolderId =
    folderId === undefined
      ? null
      : await resolveGatewayFolderId(ctx.userId, libraryId, folderId);
  return createLibraryItem({
    userId: ctx.userId,
    libraryId,
    kind: "note",
    title,
    content,
    folderId: resolvedFolderId,
  });
}

async function createLibraryItemTool(
  { libraryId, kind, title, folderId, content, databaseTemplate }: z.infer<
    typeof createLibraryItemSchema
  >,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  const resolvedFolderId =
    folderId === undefined
      ? null
      : await resolveGatewayFolderId(ctx.userId, libraryId, folderId);
  return createLibraryItem({
    userId: ctx.userId,
    libraryId,
    kind: kind as LibraryItemKind,
    title,
    folderId: resolvedFolderId,
    content,
    databaseTemplate,
  });
}

async function appendNote(
  { libraryId, documentId, text }: z.infer<typeof appendNoteSchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  await requireLibraryAccess(ctx.userId, libraryId, "EDITOR");

  const document = await prisma.document.findFirst({
    where: { id: documentId, libraryId },
    select: { id: true, title: true, content: true, storagePath: true },
  });
  if (!document) throw new Error("Document not found");
  if (document.storagePath) {
    throw new Error(
      "This document is an uploaded file; its extracted text can't be edited. Use create_note for editable notes."
    );
  }

  const existing = document.content ?? "";
  const next = existing.length > 0 ? `${existing}\n\n${text}` : text;
  await prisma.document.update({ where: { id: document.id }, data: { content: next } });
  await indexDocument(document.id, document.title, next, ctx.userId);

  return { id: document.id, length: next.length };
}

async function editNote(
  { libraryId, documentId, oldString, newString, occurrence }: z.infer<typeof editNoteSchema>,
  ctx: RecallToolContext
) {
  await authorizeLibrary(
    { userId: ctx.userId, apiKeyId: "", scopedLibraryId: ctx.scopedLibraryId },
    libraryId
  );
  await requireLibraryAccess(ctx.userId, libraryId, "EDITOR");

  const document = await prisma.document.findFirst({
    where: { id: documentId, libraryId },
    select: { id: true, title: true, content: true, storagePath: true },
  });
  if (!document) throw new Error("Document not found");
  if (document.storagePath) {
    throw new Error(
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
  await indexDocument(document.id, document.title, next, ctx.userId);

  return { id: document.id, replaced, length: next.length };
}

/** OpenAI tool definitions — mirrors MCP tool surface. */
export const RECALL_OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_libraries",
      description:
        "List the wenlo libraries this user can access. Use the returned id as libraryId for other tools.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_library",
      description:
        "Semantic + keyword search across documents and pages in a library. Returns ranked snippets with source ids.",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string", description: "Library id to search within" },
          query: { type: "string", description: "Natural language or keyword query" },
          folderId: {
            type: "string",
            description: "Restrict to a folder id (omit for the whole library)",
          },
          limit: { type: "integer", description: "Max results (default 20, max 50)" },
        },
        required: ["libraryId", "query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep_library",
      description:
        "Exact literal or regex grep across page and note text with line numbers and context. Use for precise strings, identifiers, and code symbols.",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string", description: "Library id to search within" },
          pattern: { type: "string", description: "Literal text or regex pattern to find" },
          folderId: {
            type: "string",
            description: "Restrict to a folder id (omit for the whole library)",
          },
          caseSensitive: { type: "boolean", description: "Case-sensitive match (default false)" },
          regex: { type: "boolean", description: "Treat pattern as regex (default false)" },
          limit: { type: "integer", description: "Max files with hits (default 20, max 50)" },
          contextLines: {
            type: "integer",
            description: "Context lines before/after each hit (default 1, max 5)",
          },
        },
        required: ["libraryId", "pattern"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_documents",
      description:
        "List documents in a library (optionally within a folder). Use get_document for text content.",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string" },
          folderId: { type: "string", description: "Folder id (omit for library root)" },
          limit: { type: "integer", description: "Max documents (default 50, max 200)" },
        },
        required: ["libraryId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_document",
      description: "Fetch a document's metadata and extracted text content.",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string" },
          documentId: { type: "string" },
        },
        required: ["libraryId", "documentId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "download_file",
      description:
        "Download file metadata. Prefer get_document for text. Binary payloads are omitted in chat.",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string" },
          documentId: { type: "string" },
        },
        required: ["libraryId", "documentId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a new text note in a library (requires EDITOR access).",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string" },
          title: { type: "string" },
          content: { type: "string", description: "Initial body text" },
          folderId: { type: "string", description: "Folder id (omit for library root)" },
        },
        required: ["libraryId", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_library_item",
      description:
        "Create a new library item. kind: note (plain text doc), page (BlockNote doc), whiteboard, deck, database, or flowchart. Requires EDITOR access.",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string" },
          kind: {
            type: "string",
            enum: [...LIBRARY_ITEM_KINDS],
            description: "note | page | whiteboard | deck | database | flowchart",
          },
          title: { type: "string", description: "Item title" },
          folderId: { type: "string", description: "Folder id (omit for library root)" },
          content: { type: "string", description: "Plain text for note or page body" },
          databaseTemplate: {
            type: "string",
            description: "For database kind: tasks, contacts, or roadmap",
          },
        },
        required: ["libraryId", "kind"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "append_to_note",
      description: "Append text to an existing native note (requires EDITOR access).",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string" },
          documentId: { type: "string" },
          text: { type: "string" },
        },
        required: ["libraryId", "documentId", "text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_note",
      description: "Patch a note by replacing a substring (requires EDITOR access).",
      parameters: {
        type: "object",
        properties: {
          libraryId: { type: "string" },
          documentId: { type: "string" },
          oldString: { type: "string", description: "Exact substring to replace" },
          newString: { type: "string", description: "Replacement text" },
          occurrence: {
            description: "Which match: 1 (default), 2, 3, …, or 'all'",
          },
        },
        required: ["libraryId", "documentId", "oldString", "newString"],
        additionalProperties: false,
      },
    },
  },
];

export const MAX_AGENT_TOOL_ITERATIONS = 8;

type ToolCallAccumulator = {
  id: string;
  name: string;
  arguments: string;
};

export function collectStreamingToolCalls(
  existing: Map<number, ToolCallAccumulator>,
  deltas: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall[] | undefined
): Map<number, ToolCallAccumulator> {
  if (!deltas?.length) return existing;
  const next = new Map(existing);
  for (const delta of deltas) {
    const index = delta.index ?? 0;
    const current = next.get(index) ?? { id: "", name: "", arguments: "" };
    if (delta.id) current.id = delta.id;
    if (delta.function?.name) current.name = delta.function.name;
    if (delta.function?.arguments) current.arguments += delta.function.arguments;
    next.set(index, current);
  }
  return next;
}

export function finalizedToolCalls(
  accumulated: Map<number, ToolCallAccumulator>
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  return [...accumulated.values()]
    .filter((call) => call.id && call.name)
    .map((call) => ({
      id: call.id,
      name: call.name,
      arguments: call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {},
    }));
}

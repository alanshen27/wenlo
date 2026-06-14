# PRD — MCP Write Tools (agent-authored content)

**Status:** Draft · **Owner:** Alan · **Last updated:** 2026-06-14
**Tracking:** Phase 1 (create / append / patch-edit notes) → later (pages, OAuth)

---

## 1. Summary

Today the MCP surface (`/api/mcp`, see `src/app/api/[transport]/route.ts`) is **read-only**:
external agents can `list_libraries`, `search_library`, `list_documents`, `get_document`, and
`download_file`. This adds the first **write** tools so a connected agent (GPT, Claude, etc.) can
*create and modify* content in a library, not just read it.

This is the natural completion of the product thesis: the library is a structured, permissioned
knowledge layer that external agents can both **query and author** — turning it from a read-only
context provider into a read/write substrate.

## 2. Goals & non-goals

### Goals
- `create_note` — create a new text note (a `NOTE` document) in a library/folder.
- `append_to_note` — append text to an existing note.
- `edit_note` — **patch-based** edit: replace a chosen substring rather than rewriting the whole
  document, choosing *which* occurrence to replace (1st / 2nd / 3rd / … / all).
- All writes respect API-key library scoping and require **EDITOR** access.
- All writes flow through the existing indexing pipeline (`indexDocument`) so new/edited content is
  immediately searchable by the next agent.

### Non-goals (for this phase)
- **Editing Pages.** Pages are BlockNote + Yjs collaborative docs; mutating them out-of-band from an
  agent fights the CRDT/persistence layer (`src/lib/collab/*`). Deferred — agents write to text
  *documents*, which have no live-collab layer to conflict with.
- **Editing uploaded files' extracted text.** A `NOTE` created here is owned text; an uploaded PDF's
  `content` is *derived* from the stored file. Patching the derived text would desync it from the
  bytes, so `append_to_note` / `edit_note` reject documents that have a `storagePath`.
- **OAuth / dynamic client registration.** See §6 — we stay on API-key bearer auth for now.
- Deleting documents via MCP (intentionally omitted; low value, high blast radius).

## 3. Tools

All tools take `libraryId` and resolve auth via the existing `toAuth(extra)` →
`authorizeLibrary(auth, libraryId)` path, then additionally require **EDITOR** role via
`requireLibraryAccess(auth.userId, libraryId, "EDITOR")`.

| Tool | Purpose | Key inputs |
|---|---|---|
| `create_note` | Create a new `NOTE` document | `libraryId`, `title`, `content?`, `folderId?` |
| `append_to_note` | Append text to a note | `libraryId`, `documentId`, `text` |
| `edit_note` | Patch a note by string replacement | `libraryId`, `documentId`, `oldString`, `newString`, `occurrence?` |

New documents are created under `contentOwnerId(libraryId)` (matching how the app creates content in
shared libraries) with `type: "NOTE"`, `status: "READY"`, `storagePath: null`.

## 4. The patch model (`edit_note`)

Rather than re-sending the whole document (wasteful, clobbers concurrent edits, and bloats agent
context), `edit_note` is a **targeted string replacement** — the same mental model as a code editor's
find-and-replace.

Inputs:
- `oldString` — the exact substring to find (must be non-empty).
- `newString` — what to replace it with (may be empty, i.e. a deletion).
- `occurrence` — **which match to replace**:
  - `1` (default) → the **first** occurrence only
  - `2` → the **second**, `3` → the **third**, … (1-based)
  - `"all"` → **every** occurrence

Semantics & safety:
- Occurrences are counted **non-overlapping**, left to right (so `count`, the nth-index, and `"all"`
  all agree).
- If `oldString` is not found → error.
- If a numeric `occurrence` exceeds the number of matches → error reporting how many were found (so
  the agent can retry with a more specific `oldString` or a valid index).
- The result reports how many replacements were made.

Pure logic lives in `src/lib/documents/text-patch.ts` (`applyTextPatch`) so it's unit-testable and
independent of the MCP layer.

After any write, `indexDocument(id, title, content)` re-chunks/re-embeds the note so search stays
current. The document keeps its **stable id**, so references/citations don't break (the reason patch
beats delete-and-recreate).

## 5. Permissions & scoping

- API keys may be **library-scoped** (`McpAuthExtra.scopedLibraryId`); `authorizeLibrary` already
  rejects cross-library use.
- Writes additionally require **EDITOR** (`requireLibraryAccess(..., "EDITOR")`); VIEWER keys can
  read but not write.
- `append_to_note` / `edit_note` look the document up by `{ id, libraryId }` (after authorization),
  not by `userId`, so notes in shared libraries are editable by any authorized editor.

## 6. Auth: how the "callback" flow works, and why we defer it

The tools above authenticate with a **bearer API key** (`rcsk_…`), validated in
`verifyRecallApiKey` (`src/lib/auth/mcp-auth.ts`). Simple, and good enough for a single user wiring
up their own agent.

The "callback auth thing" most products use for third-party agents is **OAuth 2.0
Authorization Code flow with PKCE**, which the MCP spec supports:

1. The agent host (MCP client) discovers the server's OAuth metadata and (often) self-registers via
   **Dynamic Client Registration** (RFC 7591).
2. It opens the server's **`/authorize`** endpoint in the user's browser. The user logs in and
   consents.
3. The server redirects back to the client's **callback/redirect URL** with a short-lived
   **authorization `code`**.
4. The client exchanges that `code` (plus the PKCE verifier) at the server's **`/token`** endpoint
   for a short-lived **access token** (+ a refresh token).
5. The client calls the MCP endpoint with `Authorization: Bearer <access_token>`; it refreshes
   silently when the token expires.

Why companies prefer it: per-user consent, scoped + revocable + short-lived tokens, no long-lived
secret pasted into a third-party tool, and no manual key handling.

**Decision:** defer. API keys cover the current (self-serve, single-user) need with a fraction of the
moving parts. When third-party/multi-user agent access becomes a real requirement, layer OAuth in via
the MCP SDK's auth provider (the SDK already models `/authorize` + `/token` + token verification) —
the tool implementations above don't change, only the `withMcpAuth` verifier does.

## 7. Milestones

1. `applyTextPatch` helper + occurrence semantics. ✅ (this phase)
2. `create_note`, `append_to_note`, `edit_note` registered on the MCP server with EDITOR scoping and
   re-indexing. ✅ (this phase)
3. Later: agent-writable **Pages** (needs a Yjs-safe mutation path), `delete`/`move` tools, OAuth.

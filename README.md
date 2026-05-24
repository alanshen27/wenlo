# recall

Personal coding knowledge base — Obsidian-style pages + grep + semantic search.

Upload notes, PDFs, lecture slides, docs, and code snippets. Query everything with:

```bash
recall "transformer positional encoding"
```

## Stack

- **Next.js 16** (App Router)
- **Supabase** (Auth + Storage + Postgres)
- **Prisma** (ORM + pgvector)
- **TipTap** (Notion-style editor)
- **OpenAI** (embeddings + agent answers)

## Features

- Nested folders
- Editable pages (rich text + code blocks)
- File uploads with text extraction (PDF, DOCX, markdown, code)
- Keyword search (ILIKE + pg_trgm)
- Semantic search (pgvector + OpenAI embeddings)
- Agent mode — ask questions scoped to a folder or your entire library

## Setup

1. Copy env vars:

```bash
cp .env.example .env.local
```

2. Create a [Supabase](https://supabase.com) project:
   - Enable Email auth
   - Copy URL + anon key + service role key into `.env.local`
   - Copy Postgres connection strings for `DATABASE_URL` and `DIRECT_URL`

3. Install and migrate:

```bash
npm install
npx prisma migrate dev --name init
```

4. Run the SQL setup scripts (Supabase SQL editor):

```bash
# prisma/setup.sql — pgvector + search indexes
# prisma/setup-storage.sql — private "documents" bucket + RLS
```

5. Start dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start building your library.

## Billing (Lemon Squeezy)

Pro subscriptions are handled by [Lemon Squeezy](https://lemonsqueezy.com) as merchant of record (tax/VAT included).

1. Create a Lemon Squeezy account and add a **subscription product** for Pro ($12/mo or your price).
2. Copy your **API key**, **Store ID**, and Pro **Variant ID** into `.env.local`.
3. Register a webhook pointing to:
   ```
   https://YOUR_DOMAIN/api/webhooks/lemonsqueezy
   ```
   Subscribe to: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_resumed`, `subscription_payment_failed`.
4. Set the webhook signing secret as `LEMONSQUEEZY_WEBHOOK_SECRET`.
5. Set `NEXT_PUBLIC_APP_URL` to your public URL (e.g. `http://localhost:3000` in dev).

Users upgrade from **Settings → Plans** (`/settings/plan`). Cancellations are done in the Lemon Squeezy customer portal; access continues until the period ends.

Use Lemon Squeezy **test mode** while developing.

## Usage

| Action | How |
|--------|-----|
| New folder | Sidebar → folder icon |
| New page | Sidebar → + |
| Upload file | Drag onto home or use file picker |
| Search | Click **recall** button → grep mode |
| Ask agent | recall terminal → agent mode |
| Scope search | Choose "Entire app" or current folder |

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/recall` | `{ query, folderId? }` → search results |
| `POST /api/agent` | `{ question, scope, folderId? }` → AI answer + sources |
| `POST /api/pages` | Create page |
| `PATCH /api/pages/:id` | Update page (auto-reindexes) |
| `POST /api/documents` | Upload file (multipart) |
| `POST /api/folders` | Create nested folder |

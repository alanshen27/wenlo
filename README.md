# Recall

Cloud storage + notes for the agentic era. Store your files and notes, then let an agent search, read, and answer across everything you keep.

Upload PDFs, images, slides, docs, and code — then query everything with:

```bash
recall "transformer positional encoding"
```

## Stack

- **Next.js 16** (App Router)
- **Supabase** (Auth + Storage + Postgres)
- **Prisma** (ORM + pgvector)
- **TipTap** (Notion-style editor)
- **OpenAI** (embeddings, vision/file extraction + agent answers)

## Features

- Cloud storage with nested folders and libraries
- File uploads with automatic text extraction & OCR (PDF, DOCX, PPTX, XLSX, images, code, …)
- Editable notes / rich pages (rich text + code blocks)
- Keyword search (ILIKE + pg_trgm)
- Semantic search (pgvector + OpenAI embeddings)
- Recall agent — ask questions scoped to a folder or your entire library, with sources

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

## Email (Resend)

All app emails — auth (confirm, reset, magic link) and workspace invites — go through **Resend** with matching templates.

### 1. Resend + env vars

1. Create a [Resend](https://resend.com) account and verify your sending domain.
2. Add to `.env.local`:

```bash
RESEND_API_KEY=re_...
EMAIL_FROM=Recall <invites@yourdomain.com>
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional subject overrides
INVITE_EMAIL_SUBJECT={{inviter}} invited you to {{library}} on Recall
AUTH_EMAIL_SUBJECT_SIGNUP=Confirm your Recall account
AUTH_EMAIL_SUBJECT_RECOVERY=Reset your Recall password
```

### 2. Supabase Send Email hook

Route auth emails through the same Resend setup (instead of Supabase’s default mailer):

1. Supabase Dashboard → **Authentication** → **Hooks**
2. Create a **Send Email** hook (HTTPS)
3. URL: `https://YOUR_DOMAIN/api/webhooks/supabase-auth-email`
4. Generate a secret and add to `.env.local`:

```bash
SEND_EMAIL_HOOK_SECRET=v1,whsec_...
```

5. Enable the hook. Supabase will call your app for confirm/reset/magic-link emails; your app sends them via Resend.

In dev, expose localhost with ngrok/cloudflared and use that URL for the hook.

Without the hook configured, Supabase still sends its own auth emails — invites still use Resend when `RESEND_API_KEY` is set.

## Usage

| Action | How |
|--------|-----|
| New folder | Sidebar → folder icon |
| New page | Sidebar → + |
| Upload file | Drag onto home or use file picker |
| Search | Click **Recall** button → grep mode |
| Ask agent | Recall terminal → agent mode |
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

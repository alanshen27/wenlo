import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, parseBody, withAuth } from "@/lib/api/http";
import { resolveLibraryId } from "@/lib/library/libraries";
import { contentOwnerId, requireLibraryAccess } from "@/lib/library/library-access";
import { prisma } from "@/lib/db/prisma";
import { notDeleted } from "@/lib/db/filters";
import { recallSearch } from "@/lib/search/search";
import { assertWithinTokenLimit, UsageLimitError } from "@/lib/billing/usage";
import { getOpenAI, OPENAI_MODELS } from "@/lib/search/openai";
import { indexPage } from "@/lib/search/search";
import { createEmptyDeck, createEmptySlide, normalizeDeck, newDeckId } from "@/lib/decks/deck-schema";

const actionSchema = z.object({
  action: z.enum(["summarize_folder", "create_deck_from_notes", "compare_documents"]),
  libraryId: z.string().optional(),
  folderId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  title: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(undefined, async ({ user }) => {
    try {
      await assertWithinTokenLimit(user.id);
    } catch (error) {
      if (error instanceof UsageLimitError) {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      throw error;
    }

    const body = await parseBody(req, actionSchema);
    const libraryId = await resolveLibraryId(user.id, body.libraryId ?? null);
    await requireLibraryAccess(user.id, libraryId, "EDITOR");
    const ownerId = await contentOwnerId(libraryId);

    if (body.action === "summarize_folder") {
      if (!body.folderId) throw badRequest("folderId required");
      const results = await recallSearch({
        userId: user.id,
        query: "summary overview key points",
        libraryId,
        folderId: body.folderId,
        limit: 15,
      });
      const context = results.map((r) => `## ${r.title}\n${r.excerpt}`).join("\n\n");
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODELS.chat,
        messages: [
          {
            role: "system",
            content:
              "Summarize the following folder contents into a cohesive page with headings and bullet points.",
          },
          { role: "user", content: context || "No content found in this folder." },
        ],
      });
      const summary = completion.choices[0]?.message?.content?.trim() ?? "";
      const page = await prisma.page.create({
        data: {
          title: body.title?.trim() || "Folder summary",
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: summary }] }],
          },
          plainText: summary,
          userId: ownerId,
          libraryId,
          folderId: body.folderId === "root" ? null : body.folderId,
        },
      });
      await indexPage(page.id, page.title, page.plainText, user.id).catch(() => {});
      return NextResponse.json({ type: "page", id: page.id, title: page.title });
    }

    if (body.action === "create_deck_from_notes") {
      const docIds = body.documentIds ?? [];
      const docs = await prisma.document.findMany({
        where: { id: { in: docIds }, libraryId, ...notDeleted },
        select: { title: true, content: true },
      });
      const notes = docs.map((d) => `# ${d.title}\n${d.content}`).join("\n\n");
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODELS.chat,
        messages: [
          {
            role: "system",
            content:
              'Create a JSON deck outline: { "slides": [{ "title": string, "bullets": string[] }] }. Return JSON only.',
          },
          { role: "user", content: notes || "Empty notes" },
        ],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      let outline: { slides?: Array<{ title?: string; bullets?: string[] }> } = {};
      try {
        outline = JSON.parse(raw);
      } catch {
        outline = { slides: [{ title: "Slide 1", bullets: [raw.slice(0, 200)] }] };
      }

      const deck = createEmptyDeck();
      deck.slideOrder = [];
      deck.slides = {};

      for (const slide of outline.slides ?? []) {
        const s = createEmptySlide(newDeckId("sl"));
        const text = [`# ${slide.title ?? "Slide"}`, ...(slide.bullets ?? []).map((b) => `• ${b}`)].join(
          "\n"
        );
        const elId = newDeckId("el");
        s.elementOrder = [elId];
        s.elements = {
          [elId]: {
            id: elId,
            type: "text",
            x: 80,
            y: 80,
            w: 1120,
            h: 520,
            text,
            fontSize: 28,
            color: "#111111",
            align: "left",
          },
        };
        deck.slides[s.id] = s;
        deck.slideOrder.push(s.id);
      }

      if (!deck.slideOrder.length) {
        const fallback = createEmptyDeck();
        deck.slideOrder = fallback.slideOrder;
        deck.slides = fallback.slides;
      }

      const normalized = normalizeDeck(deck);
      const document = await prisma.document.create({
        data: {
          title: body.title?.trim() || "Generated deck",
          type: "DECK",
          status: "READY",
          content: notes.slice(0, 5000),
          deckContent: normalized,
          userId: ownerId,
          libraryId,
        },
      });
      return NextResponse.json({ type: "document", id: document.id, title: document.title });
    }

    if (body.action === "compare_documents") {
      const ids = body.documentIds ?? [];
      if (ids.length < 2) throw badRequest("At least two documentIds required");
      const docs = await prisma.document.findMany({
        where: { id: { in: ids }, libraryId, ...notDeleted },
        select: { title: true, content: true },
      });
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODELS.chat,
        messages: [
          {
            role: "system",
            content:
              "Compare these documents side by side. Highlight similarities, differences, and key insights.",
          },
          {
            role: "user",
            content: docs.map((d) => `## ${d.title}\n${d.content.slice(0, 4000)}`).join("\n\n---\n\n"),
          },
        ],
      });
      const comparison = completion.choices[0]?.message?.content?.trim() ?? "";
      const page = await prisma.page.create({
        data: {
          title: body.title?.trim() || "Document comparison",
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: comparison }] }],
          },
          plainText: comparison,
          userId: ownerId,
          libraryId,
        },
      });
      await indexPage(page.id, page.title, comparison, user.id).catch(() => {});
      return NextResponse.json({ type: "page", id: page.id, title: page.title, comparison });
    }

    throw badRequest("Unknown action");
  });
}

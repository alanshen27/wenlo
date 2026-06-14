import PptxGenJS from "pptxgenjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/documents/storage";
import {
  DECK_HEIGHT,
  DECK_WIDTH,
  DEFAULT_SLIDE_BG,
  type DeckDoc,
  type DeckElement,
  type ImageElement,
} from "@/lib/decks/deck-schema";

// 16:9 PowerPoint canvas in inches; deck coordinates map onto it uniformly.
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;
const PX_TO_IN = SLIDE_W_IN / DECK_WIDTH; // == SLIDE_H_IN / DECK_HEIGHT
const PX_TO_PT = PX_TO_IN * 72;

const inX = (px: number) => +(px * PX_TO_IN).toFixed(3);
const inY = (px: number) => +(px * PX_TO_IN).toFixed(3);

/** pptxgenjs wants bare hex (no leading #). Falls back to a default. */
function hex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const c = color.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : fallback;
}

function isTransparent(color: string | undefined): boolean {
  return !color || color === "transparent";
}

/** Resolves an image element to a base64 data URI pptxgenjs can embed. Pulls
 *  library files straight from storage (the editor src is an auth-gated route
 *  we can't fetch unauthenticated server-side). */
async function imageDataUri(el: ImageElement): Promise<string | null> {
  try {
    if (el.documentId) {
      const { prisma } = await import("@/lib/db/prisma");
      const doc = await prisma.document.findFirst({
        where: { id: el.documentId },
        select: { storagePath: true, mimeType: true },
      });
      if (doc?.storagePath) {
        const supabase = createAdminClient();
        const { data } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .download(doc.storagePath);
        if (data) {
          const buffer = Buffer.from(await data.arrayBuffer());
          const mime = doc.mimeType || data.type || "image/png";
          return `data:${mime};base64,${buffer.toString("base64")}`;
        }
      }
    }
    // Remote/absolute URLs can be fetched directly.
    if (/^https?:\/\//.test(el.src)) {
      const res = await fetch(el.src);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get("content-type") || "image/png";
        return `data:${mime};base64,${buffer.toString("base64")}`;
      }
    }
  } catch (error) {
    console.error("[decks] export image fetch failed", error);
  }
  return null;
}

function addElement(pptx: PptxGenJS, slide: PptxGenJS.Slide, el: DeckElement, dataUri: string | null) {
  const common = {
    x: inX(el.x),
    y: inY(el.y),
    w: inX(el.w),
    h: inY(el.h),
    rotate: el.rotation ?? 0,
  };

  if (el.type === "text") {
    slide.addText(el.text || " ", {
      ...common,
      fontSize: +(el.fontSize * PX_TO_PT).toFixed(1),
      color: hex(el.color, "000000"),
      bold: (el.fontWeight ?? 400) >= 600,
      italic: Boolean(el.italic),
      align: el.align ?? "left",
      valign: "top",
      fontFace: el.fontFamily || "Arial",
      margin: 0,
    });
    return;
  }

  if (el.type === "image") {
    if (!dataUri) return;
    slide.addImage({ ...common, data: dataUri });
    return;
  }

  // Shapes
  const fill = isTransparent(el.fill)
    ? { type: "none" as const }
    : { color: hex(el.fill, "FFFFFF") };
  const line = isTransparent(el.stroke)
    ? undefined
    : { color: hex(el.stroke, "000000"), width: (el.strokeWidth ?? 2) * PX_TO_PT };

  if (el.shape === "line") {
    slide.addShape(pptx.ShapeType.line, {
      x: inX(el.x),
      y: inY(el.y),
      w: inX(el.w),
      h: inY(el.h),
      rotate: el.rotation ?? 0,
      line: line ?? { color: "000000", width: (el.strokeWidth ?? 2) * PX_TO_PT },
    });
    return;
  }

  slide.addShape(el.shape === "ellipse" ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
    ...common,
    fill,
    line,
    ...(el.shape === "rect" && el.radius ? { rectRadius: inX(el.radius) } : {}),
  });
}

/** Builds a .pptx for the deck and returns it as a Node Buffer. */
export async function deckToPptx(deck: DeckDoc, title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "DECK_16x9", width: SLIDE_W_IN, height: SLIDE_H_IN });
  pptx.layout = "DECK_16x9";
  pptx.title = title;

  for (const slideId of deck.slideOrder) {
    const slide = deck.slides[slideId];
    if (!slide) continue;
    const pptxSlide = pptx.addSlide();
    pptxSlide.background = {
      color: hex(slide.background ?? deck.theme?.background, hex(DEFAULT_SLIDE_BG, "FFFFFF")),
    };

    // Pre-resolve image data so element rendering stays in z-order.
    const dataUris = new Map<string, string | null>();
    await Promise.all(
      slide.elementOrder.map(async (elId) => {
        const el = slide.elements[elId];
        if (el && el.type === "image") {
          dataUris.set(elId, await imageDataUri(el));
        }
      })
    );

    for (const elId of slide.elementOrder) {
      const el = slide.elements[elId];
      if (el) addElement(pptx, pptxSlide, el, dataUris.get(elId) ?? null);
    }
  }

  // pptxgenjs returns a Promise of the requested output type.
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

export { DECK_HEIGHT, DECK_WIDTH };

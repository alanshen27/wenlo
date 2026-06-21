import JSZip from "jszip";
import {
  createEmptyDeck,
  createEmptySlide,
  newDeckId,
  normalizeDeck,
  type DeckDoc,
  type DeckElement,
} from "@/lib/decks/deck-schema";
import { DECK_HEIGHT, DECK_WIDTH } from "@/lib/scene/scene-config";

const EMU_PER_PX = 9525; // approximate for 96dpi slides

function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX);
}

function extractTextFromTxBody(xml: string): string {
  const runs: string[] = [];
  const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) runs.push(m[1] ?? "");
  return runs.join("").trim();
}

function extractSlideBackground(xml: string): string | undefined {
  const solid = xml.match(/<a:srgbClr[^>]*val="([0-9A-Fa-f]{6})"/);
  if (solid) return `#${solid[1]}`;
  return undefined;
}

function extractShapes(slideXml: string): DeckElement[] {
  const elements: DeckElement[] = [];
  const spBlocks = slideXml.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? [];

  for (const block of spBlocks) {
    const xfrm = block.match(/<a:off[^>]*x="(\d+)"[^>]*y="(\d+)"/);
    const ext = block.match(/<a:ext[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    if (!xfrm || !ext) continue;

    const x = emuToPx(Number(xfrm[1]));
    const y = emuToPx(Number(xfrm[2]));
    const w = emuToPx(Number(ext[1]));
    const h = emuToPx(Number(ext[2]));
    const id = newDeckId("el");

    const text = extractTextFromTxBody(block);
    if (text) {
      elements.push({
        id,
        type: "text",
        x,
        y,
        w: Math.max(w, 100),
        h: Math.max(h, 40),
        text,
        fontSize: 24,
        color: "#111111",
        align: "left",
      });
      continue;
    }

    const prst = block.match(/prst="([^"]+)"/)?.[1];
    if (prst) {
      elements.push({
        id,
        type: "shape",
        x,
        y,
        w: Math.max(w, 40),
        h: Math.max(h, 40),
        shape: prst === "ellipse" ? "ellipse" : "rect",
        fill: "#e5e7eb",
        stroke: "#9ca3af",
        strokeWidth: 1,
      });
    }
  }

  return elements;
}

/** Parse a PPTX buffer into an editable DeckDoc. V1: text + basic shapes only. */
export async function pptxToDeck(buffer: Buffer): Promise<DeckDoc> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  const deck = createEmptyDeck();
  deck.slideOrder = [];
  deck.slides = {};

  if (!slideFiles.length) return deck;

  for (const path of slideFiles) {
    const xml = await zip.file(path)!.async("string");
    const slide = createEmptySlide(newDeckId("sl"));
    slide.background = extractSlideBackground(xml) ?? slide.background;

    const elements = extractShapes(xml);
    for (const el of elements) {
      slide.elements[el.id] = el;
      slide.elementOrder.push(el.id);
    }

    if (!elements.length) {
      const elId = newDeckId("el");
      slide.elements[elId] = {
        id: elId,
        type: "text",
        x: 80,
        y: 80,
        w: DECK_WIDTH - 160,
        h: DECK_HEIGHT - 160,
        text: "[Unsupported slide content]",
        fontSize: 20,
        color: "#6b7280",
        align: "left",
      };
      slide.elementOrder.push(elId);
    }

    deck.slides[slide.id] = slide;
    deck.slideOrder.push(slide.id);
  }

  return normalizeDeck(deck);
}

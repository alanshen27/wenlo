/** Client-safe helpers for Recall chat tool_call / tool_result fenced blocks. */

export type RecallToolCallBlock = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type RecallToolResultBlock = {
  id: string;
  result: unknown;
  isError?: boolean;
};

export const TOOL_CALL_FENCE = "tool_call";
export const TOOL_RESULT_FENCE = "tool_result";

export function formatToolCallBlock(call: RecallToolCallBlock): string {
  return `\n\n\`\`\`${TOOL_CALL_FENCE}\n${JSON.stringify(call, null, 2)}\n\`\`\`\n\n`;
}

export function formatToolResultBlock(result: RecallToolResultBlock): string {
  return `\n\n\`\`\`${TOOL_RESULT_FENCE}\n${JSON.stringify(result, null, 2)}\n\`\`\`\n\n`;
}

function extractFenceBody(content: string, fence: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const fenceStart = `\`\`\`${fence}`;
  const startIndex = trimmed.indexOf(fenceStart);
  if (startIndex !== -1) {
    const bodyStart = trimmed.indexOf("\n", startIndex + fenceStart.length);
    if (bodyStart === -1) return null;
    const closeIndex = trimmed.indexOf("\n```", bodyStart + 1);
    if (closeIndex === -1) return trimmed.slice(bodyStart + 1).trim();
    return trimmed.slice(bodyStart + 1, closeIndex).trim();
  }

  if (trimmed.startsWith(`${fence}\n`)) {
    return trimmed.slice(fence.length + 1).trim();
  }

  return trimmed;
}

export function parseToolCallBlock(raw: string): RecallToolCallBlock | null {
  const body = extractFenceBody(raw, TOOL_CALL_FENCE);
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as Partial<RecallToolCallBlock>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.name === "string" &&
      parsed.arguments &&
      typeof parsed.arguments === "object" &&
      !Array.isArray(parsed.arguments)
    ) {
      return {
        id: parsed.id,
        name: parsed.name,
        arguments: parsed.arguments as Record<string, unknown>,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function parseToolResultBlock(raw: string): RecallToolResultBlock | null {
  const body = extractFenceBody(raw, TOOL_RESULT_FENCE);
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as Partial<RecallToolResultBlock>;
    if (typeof parsed.id === "string" && "result" in parsed) {
      return {
        id: parsed.id,
        result: parsed.result,
        isError: Boolean(parsed.isError),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** True when streamed markdown ends inside an unfinished tool fence. */
export function hasOpenToolFence(content: string): boolean {
  const fences = ["```tool_call", "```tool_result"];
  let open: string | null = null;
  let index = 0;
  while (index < content.length) {
    const next = content.indexOf("```", index);
    if (next === -1) break;
    const lineEnd = content.indexOf("\n", next);
    const lang = lineEnd === -1 ? content.slice(next + 3) : content.slice(next + 3, lineEnd);
    if (lang === TOOL_CALL_FENCE || lang === TOOL_RESULT_FENCE) {
      open = lang;
    } else if (open) {
      open = null;
    }
    index = next + 3;
  }
  return open !== null;
}

export type AnswerSegment =
  | { type: "markdown"; content: string }
  | {
      type: "tool";
      call: RecallToolCallBlock;
      result: RecallToolResultBlock | null;
      pending: boolean;
    };

const TOOL_FENCE_RE = /```(tool_call|tool_result)\n([\s\S]*?)```/g;

function parsePartialToolCall(body: string): RecallToolCallBlock | null {
  try {
    const parsed = JSON.parse(body) as Partial<RecallToolCallBlock>;
    if (typeof parsed.id === "string" && typeof parsed.name === "string") {
      return {
        id: parsed.id,
        name: parsed.name,
        arguments:
          parsed.arguments &&
          typeof parsed.arguments === "object" &&
          !Array.isArray(parsed.arguments)
            ? (parsed.arguments as Record<string, unknown>)
            : {},
      };
    }
  } catch {
    const nameMatch = body.match(/"name"\s*:\s*"([^"]+)"/);
    const idMatch = body.match(/"id"\s*:\s*"([^"]+)"/);
    if (nameMatch && idMatch) {
      return { id: idMatch[1], name: nameMatch[1], arguments: {} };
    }
  }
  return null;
}

/** Split assistant answer into markdown prose and paired tool in/out blocks. */
export function parseAnswerSegments(content: string, streaming = false): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let lastEnd = 0;
  let pendingCall: RecallToolCallBlock | null = null;

  const pushMarkdown = (end: number) => {
    const text = content.slice(lastEnd, end).trim();
    if (text) segments.push({ type: "markdown", content: text });
  };

  for (const match of content.matchAll(TOOL_FENCE_RE)) {
    const start = match.index ?? 0;
    pushMarkdown(start);

    const kind = match[1];
    const raw = match[2];
    if (kind === TOOL_CALL_FENCE) {
      if (pendingCall && streaming) {
        segments.push({ type: "tool", call: pendingCall, result: null, pending: true });
      }
      pendingCall = parseToolCallBlock(raw);
    } else {
      const result = parseToolResultBlock(raw);
      if (result && pendingCall?.id === result.id) {
        segments.push({ type: "tool", call: pendingCall, result, pending: false });
        pendingCall = null;
      }
    }

    lastEnd = start + match[0].length;
  }

  let tail = content.slice(lastEnd);
  const openFence = tail.match(/```(tool_call|tool_result)\n([\s\S]*)$/);
  if (openFence && streaming) {
    pushMarkdown(lastEnd + (openFence.index ?? 0));
    if (openFence[1] === TOOL_CALL_FENCE) {
      if (pendingCall) {
        segments.push({ type: "tool", call: pendingCall, result: null, pending: true });
      }
      const partial = parsePartialToolCall(openFence[2]);
      if (partial) {
        segments.push({ type: "tool", call: partial, result: null, pending: true });
        pendingCall = null;
      }
    } else if (pendingCall) {
      segments.push({ type: "tool", call: pendingCall, result: null, pending: true });
      pendingCall = null;
    }
  } else {
    pushMarkdown(content.length);
    if (pendingCall) {
      segments.push({
        type: "tool",
        call: pendingCall,
        result: null,
        pending: streaming,
      });
    }
  }

  return segments;
}

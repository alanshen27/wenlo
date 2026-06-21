"use client";

import { parseAnswerSegments } from "@/lib/recall-chat/recall-tool-blocks";
import MarkdownRenderer from "@/components/recall/markdown-renderer";
import { ToolIOPair } from "@/components/recall/tool-call-card";

export function RecallAnswerContent({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const segments = parseAnswerSegments(content, streaming);

  if (segments.length === 0) {
    return streaming ? null : <MarkdownRenderer content="" />;
  }

  return (
    <div>
      {segments.map((segment, index) => {
        if (segment.type === "markdown") {
          return (
            <MarkdownRenderer
              key={`md-${index}`}
              content={segment.content}
              streaming={streaming && index === segments.length - 1}
            />
          );
        }
        return (
          <ToolIOPair
            key={`tool-${segment.call.id}-${index}`}
            call={segment.call}
            result={segment.result}
            pending={segment.pending}
          />
        );
      })}
    </div>
  );
}

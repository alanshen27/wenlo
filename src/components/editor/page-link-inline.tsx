"use client";

import { createReactInlineContentSpec } from "@blocknote/react";
import Link from "next/link";
import { pageRoute } from "@/lib/routes";
import { usePageLinkLibraryId } from "@/components/editor/page-link-context";

function resolveLibraryId(stored: string, fromContext: string | null) {
  return stored || fromContext || null;
}

function PageLinkChip({
  pageId,
  title,
  libraryId: storedLibraryId,
}: {
  pageId: string;
  title: string;
  libraryId: string;
}) {
  const libraryId = resolveLibraryId(storedLibraryId, usePageLinkLibraryId());
  const label = title.trim() || "Untitled";

  const className =
    "inline-flex max-w-full items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-sm font-medium text-primary no-underline hover:bg-primary/15";

  if (!libraryId || !pageId) {
    return <span className={className}>@{label}</span>;
  }

  return (
    <Link href={pageRoute(libraryId, pageId)} className={className}>
      @{label}
    </Link>
  );
}

export const PageLink = createReactInlineContentSpec(
  {
    type: "pageLink",
    propSchema: {
      pageId: { default: "" },
      title: { default: "Untitled" },
      libraryId: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => (
      <PageLinkChip
        pageId={inlineContent.props.pageId}
        title={inlineContent.props.title}
        libraryId={inlineContent.props.libraryId}
      />
    ),
    toExternalHTML: ({ inlineContent }) => {
      const libraryId = inlineContent.props.libraryId;
      const label = inlineContent.props.title.trim() || "Untitled";
      const href =
        libraryId && inlineContent.props.pageId
          ? pageRoute(libraryId, inlineContent.props.pageId)
          : inlineContent.props.pageId
            ? `/pages/${inlineContent.props.pageId}`
            : "#";
      return (
        <a href={href} data-inline-content-type="pageLink">
          @{label}
        </a>
      );
    },
  }
);

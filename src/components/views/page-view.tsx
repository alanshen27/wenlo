"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLibrary } from "@/components/library/library-shell";
import { PageEditor } from "@/components/editor/page-editor";
import { libraryHome, pageRoute } from "@/lib/routes";

type Page = {
  id: string;
  title: string;
  content: unknown;
  folderId: string | null;
  libraryId: string;
};

export function PageView() {
  const router = useRouter();
  const { pageId } = useParams<{ pageId: string }>();
  const { libraryId, refreshTree, setHeader } = useLibrary();

  const [page, setPage] = useState<Page | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setTitleDraft("");
    (async () => {
      const res = await fetch(`/api/pages/${pageId}`);
      if (!res.ok) {
        router.replace(libraryHome(libraryId));
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      if (data.libraryId && data.libraryId !== libraryId) {
        router.replace(pageRoute(data.libraryId, data.id));
        return;
      }
      setPage(data);
      setTitleDraft(data.title);
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId, libraryId, router]);

  useEffect(() => {
    if (!page || page.id !== pageId) return;
    setHeader({
      saving,
      titleOverride: titleDraft,
      folderIdFallback: page.folderId,
    });
  }, [page, pageId, saving, titleDraft, setHeader]);

  const savePage = useCallback(
    async (content: unknown) => {
      if (!page) return;
      setSaving(true);
      await fetch(`/api/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title: titleDraft }),
      });
      setSaving(false);
    },
    [page, titleDraft]
  );

  const saveTitle = useCallback(async () => {
    if (!page) return;
    await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    refreshTree();
  }, [page, titleDraft, refreshTree]);

  if (!page) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-12 md:px-16">
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            className="notion-page-title mb-2 w-full bg-transparent outline-none placeholder:text-muted-foreground"
            placeholder="Untitled"
          />
          <PageEditor key={page.id} pageId={page.id} content={page.content} onChange={savePage} />
        </div>
      </div>
    </>
  );
}

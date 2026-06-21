"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, House, LayoutTemplate, Loader2, PanelLeftClose, Plus, Upload } from "lucide-react";
import { AppLauncher } from "@/components/native/app-launcher";
import { LibrarySwitcher, type Library } from "@/components/sidebar/library-switcher";
import { SidebarFooter } from "@/components/sidebar/sidebar-footer";
import { LibraryModal } from "@/components/modals/library-modal";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadFiles } from "@/lib/documents/upload";
import { libraryHome, nativeHomeRoute, nativeTemplatesRoute } from "@/lib/client/routes";
import { toastError, toastSuccess } from "@/lib/client/toast";
import type { NativeKind } from "@/lib/native/native-types";
import { NATIVE_TYPES } from "@/lib/native/native-types";
import { listNativeTemplates } from "@/lib/native/native-templates";
import type { LibraryPickerOptions } from "@/hooks/use-library-picker";
import { cn } from "@/lib/core/utils";

type Props = {
  kind: NativeKind;
  libraries: Library[];
  librariesLoading?: boolean;
  activeLibraryId: string | null;
  onSelectLibrary: (id: string) => void;
  onCreateLibrary: (data: { name: string; icon: string }) => Promise<void>;
  creatingId: string | null;
  onCreateBlank: () => void;
  pickLibrary: (options: LibraryPickerOptions) => Promise<string | null>;
  onCollapse: () => void;
};

export function NativeHomeSidebar({
  kind,
  libraries,
  librariesLoading = false,
  activeLibraryId,
  onSelectLibrary,
  onCreateLibrary,
  creatingId,
  onCreateBlank,
  pickLibrary,
  onCollapse,
}: Props) {
  const cfg = NATIVE_TYPES[kind];
  const pathname = usePathname();
  const templates = listNativeTemplates(kind);
  const showTemplates = cfg.creatable && templates.length > 0;
  const homeHref = nativeHomeRoute(kind);
  const templatesHref = nativeTemplatesRoute(kind);
  const onRecent = pathname === homeHref;
  const onTemplates = pathname === templatesHref;

  const inputRef = useRef<HTMLInputElement>(null);
  const importLibraryIdRef = useRef<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  const hasLibraries = !librariesLoading && libraries.length > 0;

  async function handleImportClick() {
    if (!hasLibraries || importing) return;
    const libraryId = await pickLibrary({
      title: "Choose library for upload",
      description: "Imported files will be added to the root of this library.",
      confirmLabel: "Choose files",
      defaultLibraryId: activeLibraryId,
    });
    if (!libraryId) return;
    importLibraryIdRef.current = libraryId;
    inputRef.current?.click();
  }

  async function handleImport(files: FileList | null) {
    const libraryId = importLibraryIdRef.current;
    if (!files?.length || !libraryId || importing) return;
    setImporting(true);
    try {
      await uploadFiles({
        libraryId,
        folderId: null,
        files,
      });
      toastSuccess(
        files.length === 1 ? "File uploaded" : `${files.length} files uploaded`
      );
    } catch (error) {
      toastError(error, "Couldn't upload files");
    } finally {
      setImporting(false);
      importLibraryIdRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground">
        <div className="flex shrink-0 items-center gap-1 px-2 py-2">
          <div className="min-w-0 flex-1">
            {librariesLoading ? (
              <Skeleton className="mx-0.5 h-9 w-full rounded-md" />
            ) : (
              <LibrarySwitcher
                libraries={libraries}
                activeLibraryId={activeLibraryId}
                onSelect={onSelectLibrary}
                onCreate={() => setLibraryModalOpen(true)}
              />
            )}
          </div>
          <AppLauncher />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground"
            title="Hide sidebar"
            aria-label="Hide sidebar"
            onClick={onCollapse}
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>

        <div className="shrink-0 space-y-0.5 px-2 pb-2">
          <Button
            variant="ghost"
            className={cn(
              "h-8 w-full justify-start gap-2 px-2",
              onRecent
                ? "sidebar-item-active font-medium text-sidebar-foreground"
                : "text-muted-foreground"
            )}
            render={<Link href={homeHref} />}
          >
            <House className="size-4" />
            Recent
          </Button>

          {showTemplates && (
            <Button
              variant="ghost"
              className={cn(
                "h-8 w-full justify-start gap-2 px-2",
                onTemplates
                  ? "sidebar-item-active font-medium text-sidebar-foreground"
                  : "text-muted-foreground"
              )}
              render={<Link href={templatesHref} />}
            >
              <LayoutTemplate className="size-4" />
              Templates
            </Button>
          )}

          {(showTemplates || cfg.creatable) && <Separator className="my-2" />}

          {cfg.creatable && (
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full justify-start gap-2 px-2 text-muted-foreground"
              disabled={!hasLibraries || !!creatingId}
              onClick={onCreateBlank}
            >
              {creatingId === "blank" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {cfg.newLabel}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full justify-start gap-2 px-2 text-muted-foreground"
            disabled={!hasLibraries || importing}
            onClick={() => void handleImportClick()}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Import files
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleImport(e.target.files)}
          />

          {activeLibraryId && (
            <Button
              variant="ghost"
              className="h-8 w-full justify-start gap-2 px-2 text-muted-foreground"
              render={<Link href={libraryHome(activeLibraryId)} />}
            >
              <ExternalLink className="size-4" />
              Open library
            </Button>
          )}
        </div>

        <div className="mt-auto shrink-0">
          <SidebarFooter />
        </div>
      </aside>

      <LibraryModal
        open={libraryModalOpen}
        mode="create"
        onOpenChange={setLibraryModalOpen}
        onSubmit={onCreateLibrary}
      />
    </>
  );
}

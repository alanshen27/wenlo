"use client";

import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { PageCollaborators } from "@/components/editor/page-collaborators";
import { NativeWorkspaceTabStrip } from "@/components/native/native-workspace-tab-strip";
import { SaveStatusIndicator, type SaveStatus } from "@/components/native/save-status-indicator";
import { LibraryPickerModal } from "@/components/modals/library-picker-modal";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/client/api";
import { useLibraryPicker } from "@/hooks/use-library-picker";
import { useNativeWorkspaceAdd, useNativeWorkspaceTabs } from "@/hooks/use-native-workspace-tabs";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import type { Library } from "@/components/sidebar/library-switcher";
import type { PageCollaborator } from "@/lib/realtime/page-presence";

type SidebarChrome = {
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
};

type HomeProps = {
  mode: "home";
  kind: NativeKind;
  libraryId?: string | null;
} & SidebarChrome;

type EditorProps = {
  mode: "editor";
  kind: NativeKind;
  workspaceId: string;
  title: string;
  libraryId?: string | null;
  saveStatus?: SaveStatus;
  collaborators?: PageCollaborator[];
  remoteNotice?: string | null;
} & SidebarChrome;

export type NativeTopBarProps = HomeProps | EditorProps;

function LibraryPickerHost({
  libraryPicker,
}: {
  libraryPicker: ReturnType<typeof useLibraryPicker>;
}) {
  return (
    <LibraryPickerModal
      open={libraryPicker.open}
      options={libraryPicker.options}
      libraries={libraryPicker.libraries}
      selectedId={libraryPicker.selectedId}
      onSelect={libraryPicker.setSelectedId}
      onConfirm={libraryPicker.confirm}
      onOpenChange={libraryPicker.handleOpenChange}
    />
  );
}

export function NativeTopBar(props: NativeTopBarProps) {
  const cfg = NATIVE_TYPES[props.kind];
  const workspaceId = props.mode === "editor" ? props.workspaceId : "";
  const workspaceTitle = props.mode === "editor" ? props.title : "";

  const defaultLibraryId = props.libraryId ?? null;
  const [libraries, setLibraries] = useState<Library[] | null>(
    cfg.creatable ? null : []
  );

  useEffect(() => {
    if (!cfg.creatable) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<Library[]>("/api/libraries");
        if (!cancelled) setLibraries(data);
      } catch {
        if (!cancelled) setLibraries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg.creatable]);

  const libraryPicker = useLibraryPicker(libraries, defaultLibraryId);

  const { tabs, selectTab, closeTab, hydrated } = useNativeWorkspaceTabs(
    props.kind,
    workspaceId,
    workspaceTitle
  );

  const hasLibraries = !!libraries && libraries.length > 0;
  const { addWorkspace, adding, addLabel, canAdd } = useNativeWorkspaceAdd(
    props.kind,
    libraryPicker.prompt,
    defaultLibraryId,
    hasLibraries
  );

  const activeId = props.mode === "editor" ? props.workspaceId : null;
  const showTabs = hydrated && (tabs.length > 0 || canAdd);
  const showSidebarToggle = props.sidebarCollapsed && props.onToggleSidebar;
  const showHeader = props.mode === "editor" || showTabs || showSidebarToggle;

  if (!showHeader && props.mode === "home") {
    return <LibraryPickerHost libraryPicker={libraryPicker} />;
  }

  return (
    <>
      <header className="shrink-0 border-b border-border bg-background">
        <div className="flex h-11 items-center gap-2 px-4">
          {showSidebarToggle && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              title="Show sidebar"
              aria-label="Show sidebar"
              onClick={props.onToggleSidebar}
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          )}

          {showTabs && (
            <NativeWorkspaceTabStrip
              tabs={tabs}
              activeId={activeId}
              onSelect={selectTab}
              onClose={closeTab}
              onAdd={canAdd ? addWorkspace : undefined}
              addLabel={addLabel}
              adding={adding}
            />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {props.mode === "editor" && (
              <>
                {props.remoteNotice && (
                  <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">
                    {props.remoteNotice}
                  </span>
                )}
                <PageCollaborators collaborators={props.collaborators ?? []} />
                <SaveStatusIndicator status={props.saveStatus ?? "idle"} />
              </>
            )}
          </div>
        </div>
      </header>

      <LibraryPickerHost libraryPicker={libraryPicker} />
    </>
  );
}

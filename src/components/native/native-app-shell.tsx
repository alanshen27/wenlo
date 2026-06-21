"use client";

import type { ReactNode } from "react";
import { NativeHomeSidebar } from "@/components/native/native-home-sidebar";
import { LibraryPickerModal } from "@/components/modals/library-picker-modal";
import {
  useNativeAppShell,
  type NativeAppShellState,
} from "@/hooks/use-native-app-shell";
import type { NativeKind } from "@/lib/native/native-types";

type Props = {
  kind: NativeKind;
  preferredLibraryId?: string | null;
  topBar: (shell: NativeAppShellState) => ReactNode;
  children: ReactNode | ((shell: NativeAppShellState) => ReactNode);
};

export function NativeAppShell({ kind, preferredLibraryId, topBar, children }: Props) {
  const shell = useNativeAppShell(kind, preferredLibraryId);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {!shell.sidebarCollapsed && (
        <NativeHomeSidebar
          kind={kind}
          libraries={shell.libraries}
          librariesLoading={shell.librariesLoading}
          activeLibraryId={shell.activeLibraryId}
          onSelectLibrary={shell.selectLibrary}
          onCreateLibrary={shell.handleCreateLibrary}
          creatingId={shell.creatingId}
          onCreateBlank={() => void shell.handleCreateBlank()}
          pickLibrary={shell.libraryPicker.prompt}
          onCollapse={shell.toggleSidebar}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {topBar(shell)}
        {typeof children === "function" ? children(shell) : children}
      </div>

      <LibraryPickerModal
        open={shell.libraryPicker.open}
        options={shell.libraryPicker.options}
        libraries={shell.libraryPicker.libraries}
        selectedId={shell.libraryPicker.selectedId}
        onSelect={shell.libraryPicker.setSelectedId}
        onConfirm={shell.libraryPicker.confirm}
        onOpenChange={shell.libraryPicker.handleOpenChange}
      />
    </div>
  );
}

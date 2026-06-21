"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ItemThumbnail } from "@/components/cloud/item-previews";
import { NativeAppShell } from "@/components/native/native-app-shell";
import { NativeTopBar } from "@/components/native/native-top-bar";
import type { NativeAppShellState } from "@/hooks/use-native-app-shell";
import { createFromNativeTemplate } from "@/lib/native/create-from-template";
import { listNativeTemplates, type NativeTemplateEntry } from "@/lib/native/native-templates";
import { NATIVE_TYPES, type NativeKind } from "@/lib/native/native-types";
import { templateItemPreviewSource } from "@/lib/native/template-preview-source";
import { nativeEditorRoute } from "@/lib/client/routes";

export function NativeTemplates({ kind }: { kind: NativeKind }) {
  const cfg = NATIVE_TYPES[kind];
  const templates = useMemo(() => listNativeTemplates(kind), [kind]);

  if (!cfg.creatable || templates.length === 0) {
    return null;
  }

  return (
    <NativeAppShell
      kind={kind}
      topBar={(shell) => (
        <NativeTopBar
          mode="home"
          kind={kind}
          libraryId={shell.activeLibraryId}
          sidebarCollapsed={shell.sidebarCollapsed}
          onToggleSidebar={shell.toggleSidebar}
        />
      )}
    >
      {(shell) => <NativeTemplatesMain kind={kind} templates={templates} shell={shell} />}
    </NativeAppShell>
  );
}

function NativeTemplatesMain({
  kind,
  templates,
  shell,
}: {
  kind: NativeKind;
  templates: NativeTemplateEntry[];
  shell: NativeAppShellState;
}) {
  const router = useRouter();
  const cfg = NATIVE_TYPES[kind];

  const handleCreateTemplate = useCallback(
    async (templateId: string) => {
      if (shell.creatingId) return;
      const libraryId = await shell.libraryPicker.prompt({
        title: `Choose library for new ${cfg.label.toLowerCase()}`,
        description: `The new ${cfg.label.toLowerCase()} will be created in this library.`,
        confirmLabel: "Create",
        defaultLibraryId: shell.activeLibraryId,
      });
      if (!libraryId) return;
      shell.setCreatingId(templateId);
      try {
        const id = await createFromNativeTemplate(kind, templateId, libraryId);
        router.push(nativeEditorRoute(kind, id));
      } catch {
        shell.setCreatingId(null);
      }
    },
    [cfg.label, kind, router, shell]
  );

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from a layout, then edit in your library.
          </p>
        </header>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {templates.map((template) => (
            <li key={template.id}>
              <TemplateCard
                kind={kind}
                template={template}
                loading={shell.creatingId === template.id}
                disabled={!!shell.creatingId || shell.librariesLoading || shell.libraries.length === 0}
                onClick={() => void handleCreateTemplate(template.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function TemplateCard({
  kind,
  template,
  loading,
  disabled,
  onClick,
}: {
  kind: NativeKind;
  template: NativeTemplateEntry;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={template.description}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-foreground/30 disabled:pointer-events-none disabled:opacity-60"
    >
      {loading ? (
        <span className="flex aspect-4/3 items-center justify-center bg-white dark:bg-card">
          <Loader2 className="size-7 animate-spin text-muted-foreground" />
        </span>
      ) : (
        <ItemThumbnail
          source={templateItemPreviewSource(kind, template)}
          className="aspect-4/3 w-full bg-white dark:bg-card"
        />
      )}
      <span className="border-t border-border px-3 py-2.5 text-sm font-medium text-foreground">
        {template.label}
      </span>
    </button>
  );
}

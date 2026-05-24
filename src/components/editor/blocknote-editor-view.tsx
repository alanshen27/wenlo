"use client";

import type { BlockSchema, InlineContentSchema, StyleSchema } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/shadcn";
import { useTheme } from "next-themes";
import type { ComponentProps, ReactNode } from "react";
import { blocknoteShadCNComponents } from "@/components/editor/blocknote-shadcn-components";
import { BlockNoteSideMenuController } from "@/components/editor/blocknote-side-menu";

type Props<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
> = Omit<
  ComponentProps<typeof BlockNoteView<BSchema, ISchema, SSchema>>,
  "shadCNComponents" | "sideMenu" | "theme"
> & {
  children?: ReactNode;
};

export function BlockNoteEditorView<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>({ children, ...props }: Props<BSchema, ISchema, SSchema>) {
  const { resolvedTheme } = useTheme();

  return (
    <BlockNoteView
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      sideMenu={false}
      shadCNComponents={blocknoteShadCNComponents}
      {...props}
    >
      <BlockNoteSideMenuController />
      {children}
    </BlockNoteView>
  );
}

"use client";

import { SideMenuExtension, SuggestionMenu } from "@blocknote/core/extensions";
import {
  DragHandleMenu,
  SideMenu,
  SideMenuController,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtension,
  useExtensionState,
  type SideMenuProps,
} from "@blocknote/react";
import { GripVertical, Plus } from "lucide-react";
import { useCallback } from "react";

function LucideAddBlockButton() {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const editor = useBlockNoteEditor();
  const suggestionMenu = useExtension(SuggestionMenu);
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  const onClick = useCallback(() => {
    if (block === undefined) return;

    const blockContent = block.content;
    const isBlockEmpty =
      blockContent !== undefined &&
      Array.isArray(blockContent) &&
      blockContent.length === 0;

    if (isBlockEmpty) {
      editor.setTextCursorPosition(block);
      suggestionMenu.openSuggestionMenu("/");
    } else {
      const insertedBlock = editor.insertBlocks([{ type: "paragraph" }], block, "after")[0];
      editor.setTextCursorPosition(insertedBlock);
      suggestionMenu.openSuggestionMenu("/");
    }
  }, [block, editor, suggestionMenu]);

  if (block === undefined) return null;

  return (
    <Components.SideMenu.Button
      className="bn-button"
      label={dict.side_menu.add_block_label}
      onClick={onClick}
      icon={<Plus className="size-4" strokeWidth={2} data-test="dragHandleAdd" />}
    />
  );
}

function LucideDragHandleButton(props: SideMenuProps) {
  const Components = useComponentsContext()!;
  const dict = useDictionary();
  const sideMenu = useExtension(SideMenuExtension);
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  });

  if (block === undefined) return null;

  const Menu = props.dragHandleMenu ?? DragHandleMenu;

  return (
    <Components.Generic.Menu.Root
      onOpenChange={(open: boolean) => {
        if (open) sideMenu.freezeMenu();
        else sideMenu.unfreezeMenu();
      }}
      position="left"
    >
      <Components.Generic.Menu.Trigger>
        <Components.SideMenu.Button
          className="bn-button"
          label={dict.side_menu.drag_handle_label}
          draggable
          onDragStart={(e) => sideMenu.blockDragStart(e, block)}
          onDragEnd={sideMenu.blockDragEnd}
          icon={<GripVertical className="size-4" strokeWidth={2} data-test="dragHandle" />}
        />
      </Components.Generic.Menu.Trigger>
      <Menu />
    </Components.Generic.Menu.Root>
  );
}

function BlockNoteSideMenu(props: SideMenuProps) {
  return (
    <SideMenu {...props}>
      <LucideAddBlockButton />
      <LucideDragHandleButton {...props} />
    </SideMenu>
  );
}

/** Drop into BlockNoteView with sideMenu={false}. See blocknote side-menu docs. */
export function BlockNoteSideMenuController() {
  return <SideMenuController sideMenu={BlockNoteSideMenu} />;
}

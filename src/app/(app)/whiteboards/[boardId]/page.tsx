import { StandaloneShell } from "@/components/native/standalone-shell";
import { BoardView } from "@/components/whiteboard/board-view";

export default function WhiteboardEditorRoute() {
  return (
    <StandaloneShell kind="whiteboards">
      <BoardView />
    </StandaloneShell>
  );
}

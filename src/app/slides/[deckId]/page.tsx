import { StandaloneShell } from "@/components/native/standalone-shell";
import { DeckView } from "@/components/slideshow/deck-view";

export default function SlideEditorRoute() {
  return (
    <StandaloneShell kind="slides">
      <DeckView />
    </StandaloneShell>
  );
}

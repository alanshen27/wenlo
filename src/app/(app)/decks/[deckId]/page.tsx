import { StandaloneShell } from "@/components/native/standalone-shell";
import { DeckView } from "@/components/slideshow/deck-view";

export default function DeckEditorRoute() {
  return (
    <StandaloneShell kind="decks">
      <DeckView />
    </StandaloneShell>
  );
}

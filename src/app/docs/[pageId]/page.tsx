import { StandaloneShell } from "@/components/native/standalone-shell";
import { PageView } from "@/components/views/page-view";

export default function DocEditorRoute() {
  return (
    <StandaloneShell kind="docs">
      <PageView />
    </StandaloneShell>
  );
}

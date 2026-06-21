import { StandaloneShell } from "@/components/native/standalone-shell";
import { PageView } from "@/components/views/page-view";

export default function PageEditorRoute() {
  return (
    <StandaloneShell kind="pages">
      <PageView />
    </StandaloneShell>
  );
}

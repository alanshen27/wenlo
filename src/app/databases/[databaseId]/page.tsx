import { StandaloneShell } from "@/components/native/standalone-shell";
import { DatabaseView } from "@/components/database/database-view";

export default function DatabaseEditorRoute() {
  return (
    <StandaloneShell kind="databases">
      <DatabaseView />
    </StandaloneShell>
  );
}

import { StandaloneShell } from "@/components/native/standalone-shell";
import { FlowchartView } from "@/components/flowchart/flowchart-view";

export default function FlowchartEditorRoute() {
  return (
    <StandaloneShell kind="flowcharts">
      <FlowchartView />
    </StandaloneShell>
  );
}

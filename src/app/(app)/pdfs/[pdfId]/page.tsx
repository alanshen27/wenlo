import { StandaloneShell } from "@/components/native/standalone-shell";
import { PdfView } from "@/components/pdf/pdf-view";

export default function PdfEditorRoute() {
  return (
    <StandaloneShell kind="pdfs">
      <PdfView />
    </StandaloneShell>
  );
}

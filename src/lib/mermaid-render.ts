import mermaid from "mermaid";

let initialized = false;

function ensureMermaid() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  });
  initialized = true;
}

export async function renderMermaidDiagram(
  container: HTMLElement,
  code: string,
  id: string
): Promise<void> {
  ensureMermaid();
  const source = code.trim();

  if (!source) {
    container.innerHTML = "";
    container.dataset.state = "empty";
    return;
  }

  try {
    const { svg } = await mermaid.render(`recall-mermaid-${id}`, source);
    container.innerHTML = svg;
    container.dataset.state = "ok";
    container.removeAttribute("data-error");
  } catch (err) {
    container.dataset.state = "error";
    container.dataset.error =
      err instanceof Error ? err.message : "Invalid Mermaid diagram";
    container.innerHTML = "";
  }
}

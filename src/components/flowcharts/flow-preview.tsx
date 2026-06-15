import type { FlowDoc } from "@/lib/flowcharts/flowchart-schema";
import { flowColorStyle } from "@/lib/flowcharts/flowchart-schema";
import { cn } from "@/lib/core/utils";

const NODE_W = 120;
const NODE_H = 48;

/** Read-only SVG thumbnail of a flowchart scene (cards + native home). */
export function FlowPreview({ scene, className }: { scene: FlowDoc; className?: string }) {
  const nodes = scene.nodeOrder.map((id) => scene.nodes[id]).filter(Boolean);
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + NODE_H);
  }
  const pad = 24;
  const w = Math.max(1, maxX - minX + pad * 2);
  const h = Math.max(1, maxY - minY + pad * 2);

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${w} ${h}`}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {scene.edgeOrder.map((eid) => {
        const e = scene.edges[eid];
        if (!e) return null;
        const a = scene.nodes[e.source];
        const b = scene.nodes[e.target];
        if (!a || !b) return null;
        return (
          <line
            key={eid}
            x1={a.x + NODE_W / 2}
            y1={a.y + NODE_H / 2}
            x2={b.x + NODE_W / 2}
            y2={b.y + NODE_H / 2}
            stroke="#94a3b8"
            strokeWidth={2}
          />
        );
      })}
      {nodes.map((n) => {
        const style = flowColorStyle(n.color);
        return (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={NODE_W}
              height={NODE_H}
              rx={n.shape === "diamond" ? 4 : 8}
              fill={style.bg}
              stroke={style.border}
              strokeWidth={2}
            />
            <text
              x={n.x + NODE_W / 2}
              y={n.y + NODE_H / 2 + 4}
              textAnchor="middle"
              fontSize={9}
              fill={style.text}
              fontFamily="system-ui, sans-serif"
            >
              {n.label.length > 16 ? `${n.label.slice(0, 14)}…` : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

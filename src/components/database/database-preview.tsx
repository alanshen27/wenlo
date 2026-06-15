import {
  formatCellText,
  selectColorClasses,
  type DatabaseProperty,
  type DatabaseScene,
} from "@/lib/databases/database-schema";
import { cn } from "@/lib/core/utils";

function optionForProperty(prop: DatabaseProperty, optionId: string | null | undefined) {
  if (!optionId || prop.type !== "SELECT") return null;
  return prop.options.find((o) => o.id === optionId) ?? null;
}

/** Mini table thumbnail for database cards and native home. */
export function DatabasePreview({
  scene,
  className,
}: {
  scene: DatabaseScene;
  className?: string;
}) {
  const columns = scene.properties.slice(0, 3);
  const rows = scene.rows.slice(0, 4);
  if (columns.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden bg-white px-2.5 pt-2.5 dark:bg-zinc-50",
        className
      )}
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className="truncate border-b border-slate-200 pb-1 pr-1 text-[6.5px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => {
                const value = row.cells[col.id] ?? null;
                if (col.type === "SELECT") {
                  const opt = optionForProperty(col, value as string | null);
                  return (
                    <td key={col.id} className="truncate py-0.5 pr-1">
                      {opt ? (
                        <span
                          className={cn(
                            "inline-block max-w-full truncate rounded px-1 py-px text-[6.5px] font-medium",
                            selectColorClasses(opt.color)
                          )}
                        >
                          {opt.label}
                        </span>
                      ) : null}
                    </td>
                  );
                }
                return (
                  <td
                    key={col.id}
                    className="truncate py-0.5 pr-1 text-[7px] leading-tight text-slate-600"
                  >
                    {formatCellText(col, value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

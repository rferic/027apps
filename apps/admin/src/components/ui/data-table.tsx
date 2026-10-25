import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DataTableColumn {
  label: string;
  align?: "left" | "right";
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: ReactNode[][];
  /** Etiqueta accesible de la tabla (caption/aria-label). */
  label?: string;
}

export function DataTable({ columns, rows, label }: DataTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {label ? <caption className="sr-only">{label}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn(
                  "border-b border-border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  column.align === "right" && "text-right",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => (
                <td
                  key={column.label}
                  className={cn(
                    "border-b border-border px-2.5 py-2",
                    column.align === "right" && "text-right font-mono",
                  )}
                >
                  {row[columnIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
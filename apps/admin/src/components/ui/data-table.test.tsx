import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable } from "./data-table";
import { Badge } from "./badge";

const columns = [
  { label: "Miembro" },
  { label: "Estado" },
  { label: "Balance", align: "right" as const },
];

describe("DataTable", () => {
  it("renderiza las cabeceras en uppercase muted", () => {
    const html = renderToStaticMarkup(<DataTable columns={columns} rows={[]} />);
    expect(html).toContain("<th");
    expect(html).toContain("uppercase");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain(">Miembro</th>");
    expect(html).toContain(">Balance</th>");
  });

  it("acopla una celda por columna por fila", () => {
    const activeBadge = <Badge variant="success">Activo</Badge>;
    const html = renderToStaticMarkup(
      <DataTable
        columns={columns}
        rows={[["Eric (Admin)", activeBadge, "5"]]}
      />,
    );
    expect(html).toContain(">Eric (Admin)</td>");
    expect(html).toContain("bg-success/10");
    expect(html).toContain(">5</td>");
  });

  it("alinea a la derecha en mono las columnas numéricas", () => {
    const html = renderToStaticMarkup(
      <DataTable columns={columns} rows={[["Sara", "Activo", "-340,00 €"]]} />,
    );
    expect(html).toContain("text-right");
    expect(html).toContain("font-mono");
  });

  it("separa filas con borde hairline", () => {
    const html = renderToStaticMarkup(<DataTable columns={columns} rows={[]} />);
    expect(html).toContain("border-b");
    expect(html).toContain("border-border");
  });
});
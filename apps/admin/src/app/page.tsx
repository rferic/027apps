import { LayoutShell, type NavItem } from "@/components/layout-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", active: true },
  { label: "Miembros", href: "#miembros" },
  { label: "Gastos", href: "#gastos" },
  { label: "Módulos", href: "#modulos" },
  { label: "Ajustes", href: "#ajustes" },
];

const MEMBERS_TABLE_TITLE = "Miembros";

const statusBadge = (variant: "success" | "neutral", label: string) => (
  <Badge variant={variant}>{label}</Badge>
);

const balanceCell = (amount: string, tone: "success" | "destructive" | "default") => (
  <span className={{ success: "text-success", destructive: "text-destructive", default: "" }[tone]}>
    {amount}
  </span>
);

const MEMBERS_ROWS = [
  ["Eric (Admin)", "Super Admin", statusBadge("success", "Activo"), balanceCell("+120,50 €", "success")],
  ["Sara", "Member", statusBadge("success", "Activo"), balanceCell("0,00 €", "default")],
  ["Carlos", "Member", statusBadge("neutral", "Invitado"), balanceCell("-340,00 €", "destructive")],
];

const MEMBERS_TABLE = {
  columns: [
    { label: "Miembro" },
    { label: "Rol" },
    { label: "Estado" },
    { label: "Balance", align: "right" as const },
  ],
  rows: MEMBERS_ROWS,
};

const KPIS = [
  { label: "Miembros", value: "14", delta: "+1 esta semana" },
  { label: "Gasto Total", value: "2.458,20 €", delta: "Octubre" },
  { label: "Pendiente", value: "340,00 €", tone: "destructive" as const },
  { label: "Módulos", value: "3/10" },
];

const ADD_EXPENSE = "Añadir gasto";
const SEARCH_PLACEHOLDER = "Buscar...";
const DASHBOARD_TITLE = "Dashboard Familia";

export default function Home() {
  return (
    <LayoutShell
      title={DASHBOARD_TITLE}
      nav={NAV_ITEMS}
      actions={
        <input
          type="search"
          aria-label={SEARCH_PLACEHOLDER}
          placeholder={SEARCH_PLACEHOLDER}
          className="rounded-control border border-border bg-background px-2.5 py-1.5 text-sm"
        />
      }
    >
      <section className="rounded-card border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
        <div className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {MEMBERS_TABLE_TITLE}
          </h2>
          <DataTable
            columns={MEMBERS_TABLE.columns}
            rows={MEMBERS_TABLE.rows}
            label={MEMBERS_TABLE_TITLE}
          />
        </div>
        <div className="mt-6">
          <Button>{ADD_EXPENSE}</Button>
        </div>
      </section>
    </LayoutShell>
  );
}
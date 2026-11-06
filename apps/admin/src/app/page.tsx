import Link from "next/link";
import { redirect } from "next/navigation";
import { hasActiveSuperAdmin, isSetupIncomplete } from "@027apps/core/instance/api.js";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { getInfra } from "@/lib/api/door";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "./(auth)/actions";
import { LayoutShell, type NavItem } from "@/components/layout-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";

/**
 * The panel routes by instance state and session, reading the database and the
 * auth cookies on every request: it opts out of the static shell instead of
 * being prerendered (Cache Components `instant` opt-out).
 */
export const instant = false;

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

export default async function Home() {
  // Entry gate: an uninstalled instance goes straight to the setup wizard; an
  // installed one requires a session before showing the panel.
  const { settingsDeps } = await getInfra();
  if (!(await hasActiveSuperAdmin(settingsDeps))) redirect("/setup");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  // Spec §7.3: the panel stays usable but advertises the missing configuration.
  const setupIncomplete = await isSetupIncomplete(settingsDeps);
  const settings = await readPublicSettings(settingsDeps);
  const logoUrl = typeof settings["instance.logo_url"] === "string" ? settings["instance.logo_url"] : null;

  return (
    <LayoutShell
      title={DASHBOARD_TITLE}
      nav={NAV_ITEMS}
      logoUrl={logoUrl}
      actions={
        <div className="flex items-center gap-2">
          <input
            type="search"
            aria-label={SEARCH_PLACEHOLDER}
            placeholder={SEARCH_PLACEHOLDER}
            className="w-52 shrink-0 rounded-control border border-border bg-surface px-2.5 py-1.5 text-sm"
          />
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      }
    >
      {setupIncomplete && (
        <section
          role="status"
          className="mb-3 rounded-card border border-accent bg-surface p-3 text-xs"
        >
          <span className="font-semibold">Setup is not finished.</span>{" "}
          <Link href="/setup" className="text-accent underline underline-offset-2">
            Complete the installation
          </Link>{" "}
          so invitations and deep links point at the right address.
        </section>
      )}
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
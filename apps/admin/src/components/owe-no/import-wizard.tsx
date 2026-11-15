"use client";

import { useState } from "react";
import {
  importCommitAction,
  importIdentitiesAction,
  importPreviewAction,
  type ImportChoice,
} from "@/lib/owe-no-import-actions";

type Preview = {
  movements: number;
  payments: number;
  derived: number;
  skipped: number;
  duplicates: number;
  currencies: string[];
  errors: Array<{ line: number; message: string }>;
  unresolved: string[];
  sample: Array<{
    line: number;
    occurred_on: string;
    description: string;
    amount_minor: number;
    kind: string;
    payer: string;
    duplicate: boolean;
  }>;
};

type Identity = { id: string; display_name: string };

const COPY = {
  es: {
    step1: "1 · Elige el archivo",
    step2: "2 · Revisa lo que entra",
    step3: "3 · Quién es quién",
    pick: "Selecciona el CSV de Splitwise",
    analyze: "Analizar",
    movements: "Gastos",
    payments: "Pagos",
    skipped: "Filas ignoradas",
    duplicates: "Duplicados",
    errors: "Errores",
    unresolved: "Nombres sin cuenta en el grupo",
    create: "Crear sin cuenta",
    account: "Cuenta del grupo…",
    allMapped: "Todos los nombres están asignados.",
    confirmDuplicates: "Importar también los duplicados",
    run: "Importar",
    result: "Importación terminada",
    created: "Movimientos creados",
    again: "Importar otro archivo",
    forbidden: "Solo el creador del grupo puede importar.",
    fileError: "No se pudo leer el archivo.",
    tooBig: "El archivo supera los 400 KB.",
  },
  en: {
    step1: "1 · Pick the file",
    step2: "2 · Review what comes in",
    step3: "3 · Who is who",
    pick: "Choose the Splitwise CSV",
    analyze: "Analyze",
    movements: "Expenses",
    payments: "Payments",
    skipped: "Skipped rows",
    duplicates: "Duplicates",
    errors: "Errors",
    unresolved: "Names without an account in the group",
    create: "Create without an account",
    account: "Group account…",
    allMapped: "Every name is mapped.",
    confirmDuplicates: "Import duplicates too",
    run: "Import",
    result: "Import finished",
    created: "Movements created",
    again: "Import another file",
    forbidden: "Only the group's creator can import.",
    fileError: "The file could not be read.",
    tooBig: "The file is larger than 400 KB.",
  },
} as const;

/**
 * Three-step Splitwise import for the panel: the desktop equivalent of the app's
 * wizard, with a table instead of phone sheets.
 */
export function OweImportWizard({ groupId, locale }: { groupId: string; locale: string }) {
  const copy = COPY[locale === "es" ? "es" : "en"];
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [choices, setChoices] = useState<Record<string, ImportChoice>>({});
  const [duplicates, setDuplicates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped_duplicates: number } | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);
    const [previewResult, identitiesResult] = await Promise.all([
      importPreviewAction(groupId, csv),
      importIdentitiesAction(groupId),
    ]);
    if (!previewResult.ok) {
      setError(previewResult.code === "forbidden" ? copy.forbidden : previewResult.code);
      setBusy(false);
      return;
    }
    setPreview(previewResult.preview as Preview);
    if (identitiesResult.ok) setIdentities(identitiesResult.identities as Identity[]);
    const initial: Record<string, ImportChoice> = {};
    for (const name of (previewResult.preview as Preview).unresolved) {
      initial[name] = { display_name: name };
    }
    setChoices(initial);
    setBusy(false);
  }

  async function run() {
    setBusy(true);
    setError(null);
    const response = await importCommitAction(groupId, csv, choices, duplicates);
    if (response.ok) {
      setResult({
        created: response.result.created,
        skipped_duplicates: response.result.skipped_duplicates,
      });
      setPreview(null);
      setCsv("");
      setFileName("");
    } else {
      setError(response.code === "forbidden" ? copy.forbidden : response.code);
    }
    setBusy(false);
  }

  const ready =
    preview !== null &&
    preview.errors.length === 0 &&
    preview.currencies.length <= 1 &&
    preview.unresolved.every((name) => choices[name] !== undefined);

  if (result !== null) {
    return (
      <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">{copy.result}</h2>
        <p className="text-xs text-muted-foreground">
          {copy.created}: <strong>{result.created}</strong> · {copy.duplicates}:{" "}
          {result.skipped_duplicates}
        </p>
        <button
          type="button"
          className="min-h-10 w-fit rounded-control border border-border bg-background px-3 text-xs font-semibold"
          onClick={() => setResult(null)}
        >
          {copy.again}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">{copy.step1}</h2>
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-xs"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 400 * 1024) {
              setError(copy.tooBig);
              return;
            }
            try {
              setCsv(await file.text());
              setFileName(file.name);
              setPreview(null);
              setError(null);
            } catch {
              setError(copy.fileError);
            }
          }}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={csv === "" || busy}
            onClick={analyze}
            className="min-h-10 rounded-control bg-accent px-4 text-xs font-semibold text-background disabled:opacity-40"
          >
            {copy.analyze}
          </button>
          {fileName !== "" ? <span className="text-xs text-muted-foreground">{fileName}</span> : null}
        </div>
      </div>

      {preview !== null ? (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">{copy.step2}</h2>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label={copy.movements} value={preview.movements} />
            <Stat label={copy.payments} value={preview.payments} />
            <Stat label={copy.skipped} value={preview.skipped} />
            <Stat label={copy.duplicates} value={preview.duplicates} />
          </dl>
          {preview.errors.length > 0 ? (
            <ul className="flex flex-col gap-1 text-xs text-destructive">
              {preview.errors.slice(0, 8).map((entry) => (
                <li key={entry.line}>
                  {copy.errors} · {entry.line}: {entry.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">#</th>
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Descripción</th>
                  <th className="py-1 pr-3">Pagó</th>
                  <th className="py-1">Importe</th>
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row) => (
                  <tr key={`${row.line}-${row.description}`} className="border-t border-border">
                    <td className="py-1 pr-3 text-muted-foreground">{row.line}</td>
                    <td className="py-1 pr-3">{row.occurred_on}</td>
                    <td className="py-1 pr-3">{row.description}</td>
                    <td className="py-1 pr-3">{row.payer}</td>
                    <td className="py-1 tabular-nums">
                      {(row.amount_minor / 100).toFixed(2)}
                      {row.duplicate ? " · dup" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {preview !== null ? (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">{copy.step3}</h2>
          {preview.unresolved.length === 0 ? (
            <p className="text-xs text-muted-foreground">{copy.allMapped}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {preview.unresolved.map((name) => (
                <li key={name} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="min-w-28 font-semibold">{name}</span>
                  <select
                    className="min-h-10 rounded-control border border-border bg-background px-2 text-xs"
                    value={choices[name]?.user_id ?? ""}
                    onChange={(event) => {
                      const userId = event.target.value;
                      const identity = identities.find((entry) => entry.id === userId);
                      setChoices((current) => ({
                        ...current,
                        [name]: {
                          user_id: userId === "" ? null : userId,
                          display_name: identity?.display_name ?? name,
                        },
                      }));
                    }}
                  >
                    <option value="">{copy.create}</option>
                    {identities.map((identity) => (
                      <option key={identity.id} value={identity.id}>
                        {identity.display_name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={duplicates}
              onChange={(event) => setDuplicates(event.target.checked)}
            />
            {copy.confirmDuplicates}
          </label>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={run}
            className="min-h-10 w-fit rounded-control bg-accent px-4 text-xs font-semibold text-background disabled:opacity-40"
          >
            {copy.run}
          </button>
        </div>
      ) : null}

      {error !== null ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

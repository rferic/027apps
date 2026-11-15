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
    analyze: "Analizar",
    movements: "Gastos",
    payments: "Pagos",
    skipped: "Filas ignoradas",
    duplicates: "Duplicados",
    errors: "Errores",
    unresolved: "Nombres sin cuenta en el grupo",
    create: "Crear sin cuenta",
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
    analyze: "Analyze",
    movements: "Expenses",
    payments: "Payments",
    skipped: "Skipped rows",
    duplicates: "Duplicates",
    errors: "Errors",
    unresolved: "Names without an account in the group",
    create: "Create without an account",
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
}

type Copy = (typeof COPY)["es"];

function choicesFor(preview: Preview): Record<string, ImportChoice> {
  const entries: Array<[string, ImportChoice]> = preview.unresolved.map((name) => [
    name,
    { display_name: name },
  ]);
  return Object.fromEntries(entries);
}

function isReady(preview: Preview | null, choices: Record<string, ImportChoice>): boolean {
  if (preview === null) return false;
  if (preview.errors.length > 0 || preview.currencies.length > 1) return false;
  return preview.unresolved.every((name) => choices[name] !== undefined);
}

/**
 * Three-step Splitwise import for the panel: the desktop equivalent of the app's
 * wizard, split into small steps so each one stays readable.
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
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);
    const [previewResult, identitiesResult] = await Promise.all([
      importPreviewAction(groupId, csv),
      importIdentitiesAction(groupId),
    ]);
    setBusy(false);
    if (!previewResult.ok) {
      setError(previewResult.code === "forbidden" ? copy.forbidden : previewResult.code);
      return;
    }
    const value = previewResult.preview as Preview;
    setPreview(value);
    setChoices(choicesFor(value));
    if (identitiesResult.ok) setIdentities(identitiesResult.identities as Identity[]);
  }

  async function run() {
    setBusy(true);
    setError(null);
    const response = await importCommitAction(groupId, csv, choices, duplicates);
    setBusy(false);
    if (!response.ok) {
      setError(response.code === "forbidden" ? copy.forbidden : response.code);
      return;
    }
    setResult({
      created: response.result.created,
      skipped: response.result.skipped_duplicates,
    });
    setPreview(null);
    setCsv("");
    setFileName("");
  }

  async function pick(file: File | undefined) {
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
  }

  if (result !== null) {
    return (
      <ResultStep
        copy={copy}
        created={result.created}
        skipped={result.skipped}
        onAgain={() => setResult(null)}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <FileStep
        copy={copy}
        fileName={fileName}
        disabled={csv === "" || busy}
        onPick={pick}
        onAnalyze={analyze}
      />
      {preview ? <PreviewStep copy={copy} preview={preview} /> : null}
      {preview ? (
        <MappingStep
          copy={copy}
          preview={preview}
          identities={identities}
          choices={choices}
          onChoice={(name, choice) => setChoices((current) => ({ ...current, [name]: choice }))}
          duplicates={duplicates}
          onDuplicates={setDuplicates}
          ready={isReady(preview, choices)}
          busy={busy}
          onRun={run}
        />
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

function FileStep({
  copy,
  fileName,
  disabled,
  onPick,
  onAnalyze,
}: {
  copy: Copy;
  fileName: string;
  disabled: boolean;
  onPick: (file: File | undefined) => void;
  onAnalyze: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">{copy.step1}</h2>
      <input
        type="file"
        accept=".csv,text/csv"
        className="text-xs"
        onChange={(event) => onPick(event.target.files?.[0])}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onAnalyze}
          className="min-h-10 rounded-control bg-accent px-4 text-xs font-semibold text-background disabled:opacity-40"
        >
          {copy.analyze}
        </button>
        {fileName ? <span className="text-xs text-muted-foreground">{fileName}</span> : null}
      </div>
    </div>
  );
}

function PreviewStep({ copy, preview }: { copy: Copy; preview: Preview }) {
  return (
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
  );
}

function MappingStep({
  copy,
  preview,
  identities,
  choices,
  onChoice,
  duplicates,
  onDuplicates,
  ready,
  busy,
  onRun,
}: {
  copy: Copy;
  preview: Preview;
  identities: Identity[];
  choices: Record<string, ImportChoice>;
  onChoice: (name: string, choice: ImportChoice) => void;
  duplicates: boolean;
  onDuplicates: (value: boolean) => void;
  ready: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  return (
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
                  onChoice(name, {
                    user_id: userId === "" ? null : userId,
                    display_name: identity?.display_name ?? name,
                  });
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
          onChange={(event) => onDuplicates(event.target.checked)}
        />
        {copy.confirmDuplicates}
      </label>
      <button
        type="button"
        disabled={!ready || busy}
        onClick={onRun}
        className="min-h-10 w-fit rounded-control bg-accent px-4 text-xs font-semibold text-background disabled:opacity-40"
      >
        {copy.run}
      </button>
    </div>
  );
}

function ResultStep({
  copy,
  created,
  skipped,
  onAgain,
}: {
  copy: Copy;
  created: number;
  skipped: number;
  onAgain: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">{copy.result}</h2>
      <p className="text-xs text-muted-foreground">
        {copy.created}: <strong>{created}</strong> · {copy.duplicates}: {skipped}
      </p>
      <button
        type="button"
        className="min-h-10 w-fit rounded-control border border-border bg-background px-3 text-xs font-semibold"
        onClick={onAgain}
      >
        {copy.again}
      </button>
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

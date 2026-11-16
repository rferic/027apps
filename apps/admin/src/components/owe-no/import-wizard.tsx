"use client";

import { useRef, useState } from "react";
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

/** 2 MB: the same limit the API enforces, so the browser never truncates silently. */
const MAX_BYTES = 2 * 1024 * 1024;

const COPY = {
  es: {
    title: "Importar de Splitwise",
    intro:
      "Sube el CSV del grupo. Primero verás qué entra, después a quién corresponde cada nombre y solo entonces se escribe nada.",
    where: "¿Dónde está el CSV? En Splitwise: grupo → ajustes → Exportar como CSV.",
    drop: "Arrastra el CSV aquí",
    or: "o elige el archivo de tu ordenador",
    pick: "Elegir archivo",
    change: "Cambiar",
    limit: "Formato .csv, hasta 2 MB.",
    analyze: "Analizar archivo",
    analyzing: "Analizando…",
    noFile: "Elige un archivo para continuar.",
    step1: "El archivo",
    step2: "Qué entra",
    step3: "Quién es quién",
    step4: "Listo",
    movements: "Gastos",
    payments: "Pagos",
    skipped: "Filas vacías",
    duplicates: "Ya importados",
    derived: "Sin coste (deducido)",
    errors: "Filas con error",
    unresolved: "Nombres que no están en el grupo",
    create: "Crear sin cuenta (ficticio)",
    allMapped: "Todos los nombres están asignados.",
    mappingHint:
      "Si un nombre no existe en el grupo, créalo sin cuenta: se le podrán imputar gastos desde ya.",
    duplicatesNote: "Los movimientos que ya se importaron antes se omiten.",
    run: "Importar",
    running: "Importando…",
    result: "Importación terminada",
    created: "Movimientos creados",
    resultSkipped: "Ya estaban",
    again: "Importar otro archivo",
    forbidden: "Solo el creador del grupo puede importar.",
    fileError: "No se pudo leer el archivo.",
    tooBig: "El archivo supera los 2 MB. Exporta el grupo otra vez o divídelo.",
    notCsv: "Ese archivo no es un CSV. Exporta el grupo desde Splitwise.",
    preview: "Vista previa",
    line: "Línea",
    date: "Fecha",
    description: "Descripción",
    payer: "Pagó",
    amount: "Importe",
    duplicate: "repetido",
    waiting: "Primero analiza el archivo.",
  },
  en: {
    title: "Import from Splitwise",
    intro:
      "Upload the group's CSV. You will see what comes in, then who each name is, and only then is anything written.",
    where: "Where is the CSV? In Splitwise: group → settings → Export as CSV.",
    drop: "Drop the CSV here",
    or: "or pick the file from your computer",
    pick: "Choose file",
    change: "Change",
    limit: "CSV format, up to 2 MB.",
    analyze: "Analyze file",
    analyzing: "Analyzing…",
    noFile: "Pick a file to continue.",
    step1: "The file",
    step2: "What comes in",
    step3: "Who is who",
    step4: "Done",
    movements: "Expenses",
    payments: "Payments",
    skipped: "Empty rows",
    duplicates: "Already imported",
    derived: "No cost (derived)",
    errors: "Rows with errors",
    unresolved: "Names that are not in the group",
    create: "Create without an account (fictitious)",
    allMapped: "Every name is mapped.",
    mappingHint:
      "If a name is not in the group, create it without an account: it can receive expenses from now on.",
    duplicatesNote: "Movements imported before are skipped.",
    run: "Import",
    running: "Importing…",
    result: "Import finished",
    created: "Movements created",
    resultSkipped: "Already there",
    again: "Import another file",
    forbidden: "Only the group's creator can import.",
    fileError: "The file could not be read.",
    tooBig: "The file is larger than 2 MB. Export the group again or split it.",
    notCsv: "That file is not a CSV. Export the group from Splitwise.",
    preview: "Preview",
    line: "Line",
    date: "Date",
    description: "Description",
    payer: "Paid by",
    amount: "Amount",
    duplicate: "duplicate",
    waiting: "Analyze the file first.",
  },
};

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

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Splitwise import for the panel: a drop zone that looks like one, then the
 * preview, the name mapping and the result. Each step stays a small component
 * so the flow reads top to bottom.
 */
export function OweImportWizard({ groupId, locale }: { groupId: string; locale: string }) {
  const copy = COPY[locale === "es" ? "es" : "en"];
  const [csv, setCsv] = useState("");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [choices, setChoices] = useState<Record<string, ImportChoice>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const step = result !== null ? 4 : preview !== null ? 3 : file !== null ? 2 : 1;

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
    const response = await importCommitAction(groupId, csv, choices, false);
    setBusy(false);
    if (!response.ok) {
      setError(response.code === "forbidden" ? copy.forbidden : response.code);
      return;
    }
    setResult({ created: response.result.created, skipped: response.result.skipped_duplicates });
    setPreview(null);
    setCsv("");
    setFile(null);
  }

  function reset() {
    setResult(null);
    setPreview(null);
    setCsv("");
    setFile(null);
    setChoices({});
    setError(null);
  }

  function pick(picked: File | undefined) {
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith(".csv")) {
      setError(copy.notCsv);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError(copy.tooBig);
      return;
    }
    try {
      const reader = picked.text();
      setFile({ name: picked.name, size: picked.size });
      setPreview(null);
      setError(null);
      void reader.then(setCsv).catch(() => setError(copy.fileError));
    } catch {
      setError(copy.fileError);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <Stepper copy={copy} step={step} />
      {result !== null ? (
        <ResultStep copy={copy} created={result.created} skipped={result.skipped} onAgain={reset} />
      ) : (
        <FileStep
          copy={copy}
          file={file}
          busy={busy}
          ready={csv !== ""}
          onPick={pick}
          onClear={() => {
            setFile(null);
            setCsv("");
            setPreview(null);
          }}
          onAnalyze={analyze}
        />
      )}
      {error ? (
        <p role="alert" className="rounded-control border border-destructive bg-surface px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {preview ? <PreviewStep copy={copy} preview={preview} /> : null}
      {preview ? (
        <MappingStep
          copy={copy}
          preview={preview}
          identities={identities}
          choices={choices}
          onChoice={(name, choice) => setChoices((current) => ({ ...current, [name]: choice }))}
          ready={isReady(preview, choices)}
          busy={busy}
          onRun={run}
        />
      ) : null}
    </section>
  );
}

function Stepper({ copy, step }: { copy: Copy; step: number }) {
  const labels = [copy.step1, copy.step2, copy.step3, copy.step4];
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      {labels.map((label, index) => {
        const position = index + 1;
        const done = position < step;
        const current = position === step;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                done
                  ? "border-accent bg-accent text-background"
                  : current
                    ? "border-accent text-accent"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done ? "✓" : position}
            </span>
            <span className={current ? "font-semibold text-foreground" : "text-muted-foreground"}>
              {label}
            </span>
            {position < labels.length ? <span className="text-border">—</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function FileStep({
  copy,
  file,
  busy,
  ready,
  onPick,
  onClear,
  onAnalyze,
}: {
  copy: Copy;
  file: { name: string; size: number } | null;
  busy: boolean;
  ready: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
  onAnalyze: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-bold">{copy.title}</h2>
        <p className="text-xs text-muted-foreground">{copy.intro}</p>
      </div>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onPick(event.dataTransfer.files?.[0]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-8 text-center transition ${
          dragging ? "border-accent bg-accent/5" : "border-border hover:border-accent/60"
        }`}
      >
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => onPick(event.target.files?.[0])}
        />
        <span className="text-sm font-semibold">{copy.drop}</span>
        <span className="text-xs text-muted-foreground">{copy.or}</span>
        <span className="mt-1 min-h-9 rounded-control bg-accent px-4 py-2 text-xs font-semibold text-background">
          {copy.pick}
        </span>
        <span className="text-[11px] text-muted-foreground">{copy.limit}</span>
      </label>

      {file ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-border px-3 py-2">
          <span className="text-xs font-semibold">{file.name}</span>
          <span className="text-[11px] text-muted-foreground">{humanSize(file.size)}</span>
          <button
            type="button"
            onClick={() => {
              onClear();
              if (input.current) input.current.value = "";
            }}
            className="text-[11px] font-semibold text-accent hover:underline"
          >
            {copy.change}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready || busy}
          onClick={onAnalyze}
          className="min-h-10 rounded-control bg-accent px-4 text-xs font-semibold text-background disabled:opacity-40"
        >
          {busy ? copy.analyzing : copy.analyze}
        </button>
        {!ready ? <span className="text-[11px] text-muted-foreground">{copy.noFile}</span> : null}
      </div>
      <p className="text-[11px] text-muted-foreground">{copy.where}</p>
    </div>
  );
}

function PreviewStep({ copy, preview }: { copy: Copy; preview: Preview }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">{copy.step2}</h2>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        <Stat label={copy.movements} value={preview.movements} />
        <Stat label={copy.payments} value={preview.payments} />
        <Stat label={copy.duplicates} value={preview.duplicates} />
        <Stat label={copy.derived} value={preview.derived} />
        <Stat label={copy.skipped} value={preview.skipped} />
      </dl>
      {preview.errors.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-control border border-destructive px-3 py-2 text-xs text-destructive">
          {preview.errors.slice(0, 8).map((entry) => (
            <li key={entry.line}>
              {copy.line} {entry.line}: {entry.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">{copy.line}</th>
              <th className="py-1 pr-3">{copy.date}</th>
              <th className="py-1 pr-3">{copy.description}</th>
              <th className="py-1 pr-3">{copy.payer}</th>
              <th className="py-1">{copy.amount}</th>
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
                  {row.duplicate ? ` · ${copy.duplicate}` : ""}
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
  ready,
  busy,
  onRun,
}: {
  copy: Copy;
  preview: Preview;
  identities: Identity[];
  choices: Record<string, ImportChoice>;
  onChoice: (name: string, choice: ImportChoice) => void;
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
        <>
          <p className="text-xs text-muted-foreground">{copy.mappingHint}</p>
          <ul className="flex flex-col gap-2">
            {preview.unresolved.map((name) => (
              <li key={name} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="min-w-32 font-semibold">{name}</span>
                <select
                  aria-label={`${copy.step3}: ${name}`}
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
        </>
      )}
      <p className="text-[11px] text-muted-foreground">{copy.duplicatesNote}</p>
      <button
        type="button"
        disabled={!ready || busy}
        onClick={onRun}
        className="min-h-10 w-fit rounded-control bg-accent px-4 text-xs font-semibold text-background disabled:opacity-40"
      >
        {busy ? copy.running : copy.run}
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
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <span aria-hidden="true">✓</span> {copy.result}
      </h2>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label={copy.created} value={created} />
        <Stat label={copy.resultSkipped} value={skipped} />
      </dl>
      <button
        type="button"
        className="min-h-10 w-fit rounded-control border border-border bg-background px-3 text-xs font-semibold"
        onClick={onAgain}
      >
        {copy.again}
      </button>
    </div>
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

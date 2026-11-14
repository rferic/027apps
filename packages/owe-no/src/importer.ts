import { createHash } from "node:crypto";
import { addMovement, listMembers, type OweDb, type OweDeps } from "./service";
import { OweDomainError } from "./service";
import { parseSplitwiseCsv, type ParsedMovement } from "./splitwise";

/** 2 MB and 5.000 rows, as the spec caps a user file. */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5_000;

export interface ImportPreviewRow {
  line: number;
  occurred_on: string;
  description: string;
  amount_minor: number;
  kind: "expense" | "settlement";
  payer: string;
  derived: boolean;
  duplicate: boolean;
}

export interface ImportPreview {
  movements: number;
  payments: number;
  derived: number;
  skipped: number;
  errors: Array<{ line: number; message: string }>;
  currencies: string[];
  /** Names the CSV has that no group member matches. */
  unresolved: string[];
  duplicates: number;
  sample: ImportPreviewRow[];
}

/** Stable per line: the CSV has no expense id, so the content is the identity. */
export function rowHash(movement: ParsedMovement): string {
  const shares = [...movement.shares]
    .map((share) => `${share.name}:${share.amount_minor}`)
    .sort()
    .join(",");
  const payload = [
    movement.occurred_on,
    movement.description,
    movement.amount_minor,
    movement.currency,
    movement.payer,
    shares,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function assertSize(csv: string): ParsedMovement[] {
  if (Buffer.byteLength(csv, "utf8") > MAX_BYTES) {
    throw new OweDomainError("validation_failed", "the file is larger than 2 MB", {
      code: "file_too_large",
    });
  }
  const parsed = parseSplitwiseCsv(csv);
  if (parsed.movements.length + parsed.errors.length > MAX_ROWS) {
    throw new OweDomainError("validation_failed", "the file has more than 5000 rows", {
      code: "too_many_rows",
    });
  }
  return parsed.movements;
}

async function groupContext(deps: OweDeps, userId: string, groupId: string) {
  const { rows } = await deps.db.query(
    "select id, currency, created_by from module_owe_no.owe_no_groups where id = $1",
    [groupId],
  );
  if (!rows[0]) throw new OweDomainError("not_found", "group not found");
  if (rows[0].created_by !== userId) {
    throw new OweDomainError("forbidden", "only the group creator imports");
  }
  return { currency: String(rows[0].currency) };
}

async function knownHashes(deps: OweDeps, groupId: string): Promise<Set<string>> {
  const { rows } = await deps.db.query(
    `select distinct r.row_hash
       from module_owe_no.owe_no_import_rows r
       join module_owe_no.owe_no_imports i on i.id = r.import_id
      where i.group_id = $1`,
    [groupId],
  );
  return new Set(rows.map((row) => String(row.row_hash)));
}

function assertOneCurrency(
  movements: ParsedMovement[],
  currencies: string[],
  groupCurrency: string,
): void {
  if (currencies.length > 1) {
    throw new OweDomainError("validation_failed", "the file mixes currencies", {
      code: "multi_currency",
      currencies,
    });
  }
  if (currencies.length === 1 && currencies[0] !== groupCurrency) {
    throw new OweDomainError("validation_failed", "the file currency does not match the group", {
      code: "currency_mismatch",
      currency: currencies[0],
      group_currency: groupCurrency,
    });
  }
  void movements;
}

/**
 * Dry run: parses, checks the currency, resolves names against the group's
 * members and lists duplicates. Writes nothing.
 */
export async function previewImport(
  deps: OweDeps,
  userId: string,
  groupId: string,
  csv: string,
): Promise<ImportPreview> {
  const { currency } = await groupContext(deps, userId, groupId);
  const parsed = parseSplitwiseCsv(csv);
  assertSize(csv);
  assertOneCurrency(parsed.movements, parsed.currencies, currency);

  const members = await listMembers(deps, userId, groupId);
  const names = new Set(members.map((member) => member.display_name));
  const unresolved = new Set<string>();
  for (const movement of parsed.movements) {
    const people = [movement.payer, ...movement.shares.map((share) => share.name)];
    for (const person of people) if (!names.has(person)) unresolved.add(person);
  }

  const hashes = await knownHashes(deps, groupId);
  const withHash = parsed.movements.map((movement) => ({
    movement,
    hash: rowHash(movement),
    duplicate: hashes.has(rowHash(movement)),
  }));

  return {
    movements: parsed.movements.length,
    payments: parsed.movements.filter((movement) => movement.kind === "settlement").length,
    derived: parsed.movements.filter((movement) => movement.derived).length,
    skipped: parsed.skipped,
    errors: parsed.errors,
    currencies: parsed.currencies,
    unresolved: [...unresolved],
    duplicates: withHash.filter((entry) => entry.duplicate).length,
    sample: withHash.slice(0, 10).map(({ movement, duplicate }) => ({
      line: movement.line,
      occurred_on: movement.occurred_on,
      description: movement.description,
      amount_minor: movement.amount_minor,
      kind: movement.kind,
      payer: movement.payer,
      derived: movement.derived,
      duplicate,
    })),
  };
}

export interface ImportCommitResult {
  created: number;
  skipped_duplicates: number;
  errors: number;
  categories: number;
}

/**
 * Commits the file in one transaction: either every accepted row lands with its
 * batch record, or nothing does. Names must already be mapped to members.
 */
export async function commitImport(
  deps: OweDeps,
  userId: string,
  groupId: string,
  csv: string,
  options: { mapping?: Record<string, string>; confirmDuplicates?: boolean } = {},
): Promise<ImportCommitResult> {
  const { currency } = await groupContext(deps, userId, groupId);
  const parsed = parseSplitwiseCsv(csv);
  assertSize(csv);
  assertOneCurrency(parsed.movements, parsed.currencies, currency);
  if (parsed.errors.length > 0) {
    throw new OweDomainError("validation_failed", "the file has rows that cannot be read", {
      code: "invalid_rows",
      errors: parsed.errors,
    });
  }

  const members = await listMembers(deps, userId, groupId);
  const byName = new Map<string, string>();
  for (const member of members) {
    if (!byName.has(member.display_name)) byName.set(member.display_name, member.id);
  }
  for (const [name, memberId] of Object.entries(options.mapping ?? {})) byName.set(name, memberId);

  const unresolved = new Set<string>();
  for (const movement of parsed.movements) {
    for (const name of [movement.payer, ...movement.shares.map((share) => share.name)]) {
      if (!byName.has(name)) unresolved.add(name);
    }
  }
  if (unresolved.size > 0) {
    throw new OweDomainError("validation_failed", "some names are not linked to a member", {
      code: "unmapped_identity",
      names: [...unresolved],
    });
  }

  const hashes = await knownHashes(deps, groupId);
  const rows = parsed.movements.map((movement) => ({
    movement,
    hash: rowHash(movement),
    duplicate: hashes.has(rowHash(movement)),
  }));
  const duplicates = rows.filter((row) => row.duplicate).length;
  if (duplicates > 0 && options.confirmDuplicates !== true) {
    throw new OweDomainError("conflict", "the file repeats already imported rows", {
      code: "duplicates",
      duplicates,
    });
  }

  const run = deps.withTransaction ?? (<T>(fn: (db: OweDb) => Promise<T>) => fn(deps.db));
  return run(async (db) => {
    const scoped: OweDeps = { ...deps, db };
    const categories = new Map<string, string>();
    for (const movement of parsed.movements) {
      const name = movement.category.trim();
      if (name === "" || movement.kind === "settlement" || categories.has(name)) continue;
      const { rows: existing } = await db.query(
        "select id from module_owe_no.owe_no_categories where group_id = $1 and name = $2",
        [groupId, name],
      );
      if (existing[0]) {
        categories.set(name, String(existing[0].id));
      } else {
        const { rows: created } = await db.query(
          "insert into module_owe_no.owe_no_categories (group_id, name) values ($1, $2) returning id",
          [groupId, name],
        );
        categories.set(name, String(created[0].id));
      }
    }

    const { rows: batch } = await db.query(
      `insert into module_owe_no.owe_no_imports
         (group_id, imported_by, source, row_count, created_count, skipped_count, error_count)
       values ($1, $2, 'splitwise', $3, $4, $5, $6) returning id`,
      [groupId, userId, rows.length, rows.length - duplicates, duplicates, 0],
    );
    const importId = String(batch[0].id);

    let created = 0;
    for (const row of rows) {
      const movementId = await addMovement(scoped, userId, groupId, {
        kind: row.movement.kind,
        description: row.movement.description,
        amount_minor: row.movement.amount_minor,
        occurred_on: row.movement.occurred_on,
        paid_by: byName.get(row.movement.payer)!,
        ...(categories.has(row.movement.category.trim())
          ? { category_id: categories.get(row.movement.category.trim())! }
          : {}),
        participants: row.movement.shares.map((share) => ({
          memberId: byName.get(share.name)!,
          amount_minor: share.amount_minor,
        })),
      });
      created += 1;
      await db.query(
        `insert into module_owe_no.owe_no_import_rows (import_id, row_hash, movement_id)
         values ($1, $2, $3)`,
        [importId, row.hash, movementId.id],
      );
    }

    return { created, skipped_duplicates: duplicates, errors: 0, categories: categories.size };
  });
}

export interface ImportBatchView {
  id: string;
  group_id: string;
  group_name: string;
  imported_by: string | null;
  row_count: number;
  created_count: number;
  created_at: string;
}

/** Panel history: every batch, newest first. */
export async function listImports(deps: OweDeps): Promise<ImportBatchView[]> {
  const { rows } = await deps.db.query(
    `select i.id, i.group_id, g.name, i.imported_by, i.row_count, i.created_count, i.created_at
       from module_owe_no.owe_no_imports i
       join module_owe_no.owe_no_groups g on g.id = i.group_id
      order by i.created_at desc`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    group_id: String(row.group_id),
    group_name: String(row.name),
    imported_by: row.imported_by === null ? null : String(row.imported_by),
    row_count: Number(row.row_count),
    created_count: Number(row.created_count),
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
}

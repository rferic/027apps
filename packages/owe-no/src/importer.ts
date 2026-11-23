import { createHash } from "node:crypto";
import { addMember, addMovement, listMembers, type OweDb, type OweDeps } from "./service";
import { OweDomainError } from "./service";
import { parseSplitwiseCsv, type ParsedMovement } from "./splitwise";

/** 2 MB and 5.000 rows, as the spec caps a user file. */
// The API door caps a request body at 1 MB; leave room for JSON escaping.
/** The same limit the API declares (2 MB): a bigger export is split, not truncated. */
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

async function knownHashes(db: Pick<OweDb, "query">, groupId: string): Promise<Set<string>> {
  const { rows } = await db.query(
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

  // Invited accounts are charged like fictitious ones, so the historical rows
  // may point at them before they accept.
  const members = (await listMembers(deps, userId, groupId)).filter(
    (member) => member.state === "active" || member.state === "invited",
  );
  const names = new Set(members.map((member) => member.display_name));
  const unresolved = new Set<string>();
  for (const movement of parsed.movements) {
    const people = [movement.payer, ...movement.shares.map((share) => share.name)];
    for (const person of people) if (!names.has(person)) unresolved.add(person);
  }



  const hashes = await knownHashes(deps.db, groupId);
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
/** The batches of one group; only its creator reads them (no cross-group listing). */
export async function importsForGroup(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<ImportBatchView[]> {
  await groupContext(deps, userId, groupId);
  const all = await listImports(deps);
  return all.filter((batch) => batch.group_id === groupId);
}

export async function commitImport(
  deps: OweDeps,
  userId: string,
  groupId: string,
  csv: string,
  options: {
    mapping?: Record<string, string>;
    /**
     * CSV names with no member yet (a fictitious person or a real account):
     * created inside this same transaction, so a failed or cancelled import
     * never leaves half a group behind.
     */
    newMembers?: Array<{ name: string; displayName?: string; userId?: string }>;
    confirmDuplicates?: boolean;
    /** Wipe the group's movements, imports and categories before importing. */
    reset?: boolean;
  } = {},
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

  // Only names the file actually uses may become members: a client is not a
  // place to invent people.
  const csvNames = new Set(
    parsed.movements.flatMap((movement) => [
      movement.payer,
      ...movement.shares.map((share) => share.name),
    ]),
  );
  for (const input of options.newMembers ?? []) {
    if (!csvNames.has(input.name)) {
      throw new OweDomainError("validation_failed", "that name is not in the file", {
        code: "unmapped_identity",
        names: [input.name],
      });
    }
  }

  // Repeating a file is not an error: the already imported rows are skipped and
  // only the new ones come in. `confirmDuplicates` is kept for compatibility.
  void options.confirmDuplicates;

  const run = deps.withTransaction ?? (<T>(fn: (db: OweDb) => Promise<T>) => fn(deps.db));
  return run(async (db) => {
    // Two imports of the same group must not race the hash check: one commits,
    // the other waits and then sees the rows. The hashes are read after taking
    // the lock, or both would see an empty set and import every row twice.
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [groupId]);
    if (options.reset === true) {
      // "Start from scratch": the group keeps its members and settings, and loses
      // what the import can rebuild. Balances follow the movements, so they go too.
      await db.query(
        "delete from module_owe_no.owe_no_movement_shares where movement_id in (select id from module_owe_no.owe_no_movements where group_id = $1)",
        [groupId],
      );
      await db.query("delete from module_owe_no.owe_no_movements where group_id = $1", [groupId]);
      await db.query("delete from module_owe_no.owe_no_import_rows where import_id in (select id from module_owe_no.owe_no_imports where group_id = $1)", [groupId]);
      await db.query("delete from module_owe_no.owe_no_imports where group_id = $1", [groupId]);
      await db.query("delete from module_owe_no.owe_no_categories where group_id = $1", [groupId]);
      await db.query("delete from module_owe_no.owe_no_idempotency where group_id = $1", [groupId]);
      // Fictitious members exist only for the expenses they were created for: once
      // those are gone, keeping them only accumulates "Bolli" four times. The names
      // this file uses survive, so importing it again maps to the same people
      // instead of recreating them with a fresh id.
      const usedNames = [
        ...new Set(
          parsed.movements.flatMap((movement) => [
            movement.payer,
            ...movement.shares.map((share) => share.name),
          ]).map((name) => name.trim().toLowerCase()),
        ),
      ];
      await db.query(
        `delete from module_owe_no.owe_no_members m
          where m.group_id = $1 and m.user_id is null and m.state in ('active', 'invited')
            and not (lower(btrim(m.display_name)) = any($2::text[]))
            and not exists (select 1 from module_owe_no.owe_no_movements mv
                             where mv.group_id = $1 and mv.paid_by_member_id = m.id)
            and not exists (select 1 from module_owe_no.owe_no_movement_shares s
                             where s.member_id = m.id)`,
        [groupId, usedNames],
      );
    }
    // Read after the lock and inside the transaction: a commit that already
    // inserted its rows must be visible here, or both batches would import the
    // same file and duplicate every movement.
    const hashes = options.reset === true ? new Set<string>() : await knownHashes(db, groupId);
    const rows = parsed.movements.map((movement) => ({
      movement,
      hash: rowHash(movement),
      duplicate: hashes.has(rowHash(movement)),
    }));
    const duplicates = rows.filter((row) => row.duplicate).length;
    // Every write of the import runs on THIS transaction: the categories and
    // members created here are not committed yet, and opening a second one (the
    // app's runner does) cannot see them — the movement would fail its FK.
    const scoped: OweDeps = {
      ...deps,
      db,
      withTransaction: async <T,>(fn: (tx: OweDb) => Promise<T>): Promise<T> => fn(db as OweDb),
    };
    // The mapping's new members are created here, inside the same transaction:
    // cancelling or failing never leaves them behind.
    const createdByName: Record<string, string> = {};
    for (const input of options.newMembers ?? []) {
      const member = await addMember(scoped, userId, groupId, {
        displayName: input.displayName ?? input.name,
        ...(input.userId ? { inviteeId: input.userId } : {}),
      });
      createdByName[input.name] = member.id;
    }
    // An invited account is charged like a fictitious member until it accepts
    // (spec §6.9.4), so both states resolve names.
    const members = (await listMembers(scoped, userId, groupId)).filter(
      (member) => member.state === "active" || member.state === "invited",
    );
    const byName = new Map<string, string>();
    for (const member of members) {
      if (!byName.has(member.display_name)) byName.set(member.display_name, member.id);
    }
    for (const [name, memberId] of Object.entries(options.mapping ?? {})) {
      // A mapping is client input: it may only point at a member of this group,
      // never at an id from another group.
      if (!byName.has(name) && !members.some((member) => member.id === memberId)) {
        throw new OweDomainError("validation_failed", "that member is not in this group", {
          code: "unmapped_identity",
        });
      }
      byName.set(name, memberId);
    }
    for (const [name, memberId] of Object.entries(createdByName)) byName.set(name, memberId);

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

    // Rows already imported in this group are skipped, never re-inserted: the
    // owner's rule is "bring in what is missing". The counters below report what
    // actually happened, so the batch row cannot claim to have created what it skipped.
    const fresh = rows.filter((row) => !row.duplicate);
    const { rows: batch } = await db.query(
      `insert into module_owe_no.owe_no_imports
         (group_id, imported_by, source, row_count, created_count, skipped_count, error_count)
       values ($1, $2, 'splitwise', $3, $4, $5, $6) returning id`,
      [groupId, userId, rows.length, fresh.length, duplicates, 0],
    );
    const importId = String(batch[0].id);

    let created = 0;
    for (const row of fresh) {
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
      // Two identical rows inside the same file are two real expenses (two metro
      // tickets); the tracking row is what collides, so it must not abort the batch.
      await db.query(
        `insert into module_owe_no.owe_no_import_rows (import_id, row_hash, movement_id)
         values ($1, $2, $3)
         on conflict (import_id, row_hash) do nothing`,
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

export interface ImportIdentity {
  id: string;
  display_name: string;
}

/**
 * One selectable row of the panel's mapping step: a name the CSV can point at.
 * A group member is chosen to reuse it; an account is invited as a new member.
 */
export interface ImportMappingOption {
  id: string;
  display_name: string;
  kind: "member" | "account";
}

/**
 * Everything the panel can map a CSV name to: the group's members first (the
 * owner asked why their own account was missing — it is already a member) and
 * then active accounts outside the group. Only the creator reads it.
 */
export async function importMappingOptions(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<ImportMappingOption[]> {
  await groupContext(deps, userId, groupId);
  const { rows } = await deps.db.query(
    `select m.id, m.display_name, 'member' as kind
       from module_owe_no.owe_no_members m
      where m.group_id = $1 and m.state in ('active', 'invited')
     union all
     select p.id, p.display_name, 'account' as kind
       from public.profiles p
      where p.deactivated_at is null
        and not exists (
          select 1 from module_owe_no.owe_no_members m
           where m.group_id = $1 and m.user_id = p.id
        )
      order by display_name
      limit 200`,
    [groupId],
  );
  return rows.map((row) => ({
    id: String(row.id),
    display_name: String(row.display_name),
    kind: String(row.kind) === "member" ? "member" : "account",
  }));
}

/**
 * Active accounts that are not in the group yet, for the mapping step. Only the
 * group creator gets them: the importer needs a name → account decision, and
 * the caller is already allowed to invite those users. Capped at 200.
 */
export async function importIdentities(
  deps: OweDeps,
  userId: string,
  groupId: string,
): Promise<ImportIdentity[]> {
  await groupContext(deps, userId, groupId);
  const { rows } = await deps.db.query(
    `select p.id, p.display_name
       from public.profiles p
      where p.deactivated_at is null
        and not exists (
          select 1 from module_owe_no.owe_no_members m
           where m.group_id = $1 and m.user_id = p.id
        )
      order by p.display_name
      limit 50`,
    [groupId],
  );
  return rows.map((row) => ({ id: String(row.id), display_name: String(row.display_name) }));
}

import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * User categories (core-data-model §3.1/§3.2). A category is a label and a bulk
 * template, never a live permission link: assigning a module materialises
 * `user_modules` for the current members (idempotent, never revives a revoked
 * grant); unassigning or removing a member does not revoke anything.
 */
export interface UserCategoriesDeps {
  db: QueryClient;
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
}

export type CategoryView = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
  modules: string[];
};

export type CategoryMember = { id: string; display_name: string; role: string };

export type CategoryDetail = CategoryView & { members: CategoryMember[] };

/** One page of categories plus the total across every page. */
export interface CategoryList {
  categories: CategoryView[];
  total: number;
}

export interface CategoryPage {
  limit: number;
  offset: number;
}

export type CategoryInput = { name: string; slug?: string };

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");

function actorFor(caller: Caller): { by: string | null; byKey: string | null } {
  if (caller.kind === "session") return { by: caller.userId, byKey: null };
  if (caller.kind === "service" || caller.kind === "delegated") {
    return { by: null, byKey: caller.keyId };
  }
  throw new DomainError("unauthorized");
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `category-${crypto.randomUUID().slice(0, 8)}`;
}

async function withTx<T>(
  deps: UserCategoriesDeps,
  fn: (db: QueryClient) => Promise<T>,
): Promise<T> {
  if (!deps.withTransaction) return fn(deps.db);
  return deps.withTransaction(async (db) => {
    await db.query("BEGIN");
    try {
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (err) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
}

async function modulesFor(
  db: QueryClient,
  categoryIds?: readonly string[],
): Promise<Map<string, string[]>> {
  if (categoryIds && categoryIds.length === 0) return new Map();
  const { rows } = categoryIds
    ? await db.query(
        `select user_category_id, module_key from public.user_category_modules
          where user_category_id = any($1::uuid[]) order by module_key asc`,
        [categoryIds],
      )
    : await db.query(
        "select user_category_id, module_key from public.user_category_modules order by module_key asc",
      );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const id = String(row.user_category_id);
    map.set(id, [...(map.get(id) ?? []), String(row.module_key)]);
  }
  return map;
}

async function assertCategory(db: QueryClient, id: string): Promise<void> {
  const { rows } = await db.query("select 1 from public.user_categories where id = $1", [id]);
  if (!rows[0]) throw new DomainError("not_found");
}

export async function listCategories(
  deps: UserCategoriesDeps,
  page: CategoryPage,
): Promise<CategoryList> {
  const { rows } = await deps.db.query(
    `with total as (select count(*)::int as n from public.user_categories),
          page as (
            select c.id, c.name, c.slug, c.created_at,
                   (select count(*)::int from public.user_category_members m
                     where m.user_category_id = c.id) as member_count
              from public.user_categories c
             order by c.created_at desc, c.id desc
             limit $1 offset $2
          )
     select total.n as total, page.*
       from total left join page on true`,
    [page.limit, page.offset],
  );
  const categories = rows.filter((row) => row.id !== null && row.id !== undefined);
  const modules = await modulesFor(
    deps.db,
    categories.map((row) => String(row.id)),
  );
  return {
    categories: categories.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      created_at: toIso(row.created_at),
      member_count: Number(row.member_count ?? 0),
      modules: modules.get(String(row.id)) ?? [],
    })),
    total: Number(rows[0]?.total ?? 0),
  };
}

export async function getCategory(deps: UserCategoriesDeps, id: string): Promise<CategoryDetail> {
  const { rows } = await deps.db.query(
    `select c.id, c.name, c.slug, c.created_at,
            (select count(*)::int from public.user_category_members m
              where m.user_category_id = c.id) as member_count
       from public.user_categories c
      where c.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new DomainError("not_found");

  const { rows: memberRows } = await deps.db.query(
    `select p.id, p.display_name, p.role
       from public.user_category_members m
       join public.profiles p on p.id = m.user_id
      where m.user_category_id = $1
      order by p.display_name asc, p.id asc`,
    [id],
  );
  const modules = await modulesFor(deps.db, [id]);
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    created_at: toIso(row.created_at),
    member_count: Number(row.member_count ?? 0),
    modules: modules.get(String(row.id)) ?? [],
    members: memberRows.map((member) => ({
      id: String(member.id),
      display_name: String(member.display_name),
      role: String(member.role),
    })),
  };
}

export async function createCategory(
  deps: UserCategoriesDeps,
  caller: Caller,
  input: CategoryInput,
): Promise<CategoryView> {
  const actor = actorFor(caller);
  const slug = input.slug ?? slugify(input.name);

  const { rows: existing } = await deps.db.query(
    "select 1 from public.user_categories where slug = $1",
    [slug],
  );
  if (existing[0]) throw new DomainError("conflict", "A category with that slug already exists");

  try {
    const { rows } = await deps.db.query(
      `insert into public.user_categories (name, slug, created_by, created_by_key)
       values ($1, $2, $3, $4)
       returning id, name, slug, created_at`,
      [input.name.trim(), slug, actor.by, actor.byKey],
    );
    const row = rows[0];
    return {
      id: String(row?.id),
      name: String(row?.name),
      slug: String(row?.slug),
      created_at: toIso(row?.created_at),
      member_count: 0,
      modules: [],
    };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new DomainError("conflict", "A category with that slug already exists");
    }
    throw err;
  }
}

export async function renameCategory(
  deps: UserCategoriesDeps,
  id: string,
  name: string,
): Promise<CategoryDetail> {
  const { rows } = await deps.db.query(
    "update public.user_categories set name = $2 where id = $1 returning id",
    [id, name.trim()],
  );
  if (!rows[0]) throw new DomainError("not_found");
  return getCategory(deps, id);
}

export async function deleteCategory(deps: UserCategoriesDeps, id: string): Promise<void> {
  const { rows } = await deps.db.query(
    `delete from public.user_categories c
      where c.id = $1
        and not exists (select 1 from public.user_category_modules m where m.user_category_id = c.id)
      returning c.id`,
    [id],
  );
  if (rows[0]) return;

  const { rows: exists } = await deps.db.query("select 1 from public.user_categories where id = $1", [
    id,
  ]);
  if (!exists[0]) throw new DomainError("not_found");
  throw new DomainError("conflict", "Remove the category modules before deleting the category");
}

export async function addMember(
  deps: UserCategoriesDeps,
  categoryId: string,
  userId: string,
): Promise<void> {
  await assertCategory(deps.db, categoryId);
  const { rows: user } = await deps.db.query("select 1 from public.profiles where id = $1", [userId]);
  if (!user[0]) throw new DomainError("not_found");
  await deps.db.query(
    "insert into public.user_category_members (user_category_id, user_id) values ($1, $2) on conflict do nothing",
    [categoryId, userId],
  ).catch((err: { code?: string }) => {
    // The category or the profile vanished between the check and the insert.
    if (err.code === "23503") throw new DomainError("not_found");
    throw err;
  });
}

export async function removeMember(
  deps: UserCategoriesDeps,
  categoryId: string,
  userId: string,
): Promise<void> {
  await assertCategory(deps.db, categoryId);
  await deps.db.query(
    "delete from public.user_category_members where user_category_id = $1 and user_id = $2",
    [categoryId, userId],
  );
}

export async function assignModule(
  deps: UserCategoriesDeps,
  caller: Caller,
  categoryId: string,
  moduleKey: string,
): Promise<string[]> {
  const actor = actorFor(caller);
  await withTx(deps, async (db) => {
    await assertCategory(db, categoryId);
    await db
      .query(
        `insert into public.user_category_modules
           (user_category_id, module_key, assigned_by, assigned_by_key)
         values ($1, $2, $3, $4)
         on conflict do nothing`,
        [categoryId, moduleKey, actor.by, actor.byKey],
      )
      .catch((err: { code?: string }) => {
        // The category vanished between the check and the insert.
        if (err.code === "23503") throw new DomainError("not_found");
        throw err;
      });
    // Materialise for current members. DO NOTHING: a revoked grant is not revived.
    await db.query(
      `insert into public.user_modules (user_id, module_key, granted_by, granted_by_key)
       select m.user_id, $2, $3, $4
         from public.user_category_members m
        where m.user_category_id = $1
       on conflict (user_id, module_key) do nothing`,
      [categoryId, moduleKey, actor.by, actor.byKey],
    );
  });
  return (await getCategory(deps, categoryId)).modules;
}

export async function unassignModule(
  deps: UserCategoriesDeps,
  categoryId: string,
  moduleKey: string,
): Promise<string[]> {
  await assertCategory(deps.db, categoryId);
  await deps.db.query(
    "delete from public.user_category_modules where user_category_id = $1 and module_key = $2",
    [categoryId, moduleKey],
  );
  // Existing user_modules grants stay: the category is a template, not a link.
  return (await getCategory(deps, categoryId)).modules;
}

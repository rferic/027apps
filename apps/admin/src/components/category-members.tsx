"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert, FormField } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { PanelError } from "@/components/panel-error";
import { addCategoryMember, removeCategoryMember } from "@/lib/category-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import type { CategoryFailure, CategoryMemberRow, MemberChoice } from "@/lib/panel-categories";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function memberLabel(member: CategoryMemberRow | null): string {
  if (!member) return "";
  if (member.display_name) return member.display_name;
  return member.id;
}

function roleLabel(role: string, messages: TranslationMap): string {
  switch (role) {
    case "super_admin":
      return t("Super admin", messages);
    case "admin":
      return t("Admin", messages);
    case "user":
      return t("User", messages);
    default:
      return role;
  }
}

function MutationAlert({
  title,
  error,
  messages,
}: {
  title: string;
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <FormAlert
      message={title}
      code={error.code}
      requestId={error.requestId}
      messages={messages}
    />
  );
}

function MemberList({
  members,
  onRemove,
  messages,
}: {
  members: CategoryMemberRow[];
  onRemove: (member: CategoryMemberRow) => void;
  messages: TranslationMap;
}) {
  if (members.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("This category has no members yet.", messages)}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-1.5 text-xs"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{member.display_name || member.id}</span>
            <span className="text-muted-foreground">{roleLabel(member.role, messages)}</span>
          </span>
          <Button
            variant="secondary"
            className="min-h-11"
            aria-label={`${t("Remove", messages)} ${member.display_name || member.id}`}
            onClick={() => onRemove(member)}
          >
            {t("Remove", messages)}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function AddMemberForm({
  available,
  memberQuery,
  adding,
  choicesFailure,
  retryHref,
  onSubmit,
  messages,
}: {
  available: MemberChoice[];
  memberQuery: string;
  adding: boolean;
  choicesFailure: CategoryFailure | null;
  retryHref: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  messages: TranslationMap;
}) {
  if (choicesFailure) {
    return (
      <PanelError
        error={choicesFailure}
        heading={t("We couldn't load the members available to add.", messages)}
        retryHref={retryHref}
        messages={messages}
      />
    );
  }
  if (available.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {memberQuery
          ? t("No members match {q}.", messages, { q: memberQuery })
          : t("All members already belong to this category.", messages)}
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <FormField id="category-member-add" label={t("Add member", messages)}>
        <Select id="category-member-add" name="userId" required>
          {available.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.displayName || choice.id}
            </option>
          ))}
        </Select>
      </FormField>
      <Button type="submit" variant="primary" className="min-h-11" disabled={adding}>
        {adding ? t("Adding…", messages) : t("Add member", messages)}
      </Button>
    </form>
  );
}

function RemoveMemberDialog({
  dialogRef,
  pending,
  categoryName,
  removing,
  error,
  onCancel,
  onConfirm,
  messages,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  pending: CategoryMemberRow | null;
  categoryName: string;
  removing: boolean;
  error: MutationFailure | null;
  onCancel: () => void;
  onConfirm: () => void;
  messages: TranslationMap;
}) {
  const name = memberLabel(pending);
  return (
    <Dialog
      labelledBy="category-member-remove-title"
      ref={dialogRef}
      onCancel={(event) => {
        if (removing) event.preventDefault();
      }}
      onBackdropClick={removing ? undefined : onCancel}
    >
      <h2 id="category-member-remove-title" className="text-sm font-semibold">
        {t("Remove {name} from {category}?", messages, { name, category: categoryName })}
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        {t(
          "{name} leaves this category. Module access they already have does not change.",
          messages,
          { name },
        )}
      </p>

      {error && (
        <MutationAlert
          title={t("We couldn't remove the member.", messages)}
          error={error}
          messages={messages}
        />
      )}

      <FormActions className="mt-3">
        <Button variant="secondary" className="min-h-11" onClick={onCancel} disabled={removing}>
          {t("Cancel", messages)}
        </Button>
        <Button variant="destructive" className="min-h-11" onClick={onConfirm} disabled={removing}>
          {removing ? t("Removing…", messages) : t("Remove", messages)}
        </Button>
      </FormActions>
    </Dialog>
  );
}

interface CategoryMembersProps {
  categoryId: string;
  categoryName: string;
  members: CategoryMemberRow[];
  /** Active members the picker can offer; already includes the `q` filter. */
  choices: MemberChoice[];
  memberQuery: string;
  /** The picker hit the API's 100-row cap, so it is not exhaustive. */
  truncated: boolean;
  /** The picker read failed; membership data is still valid and visible. */
  choicesFailure?: CategoryFailure | null;
  /** Reloads this page so the failed picker is read again. */
  retryHref: string;
  messages: TranslationMap;
}

/**
 * Membership management. Removing a member only drops the category label: the
 * `user_modules` grants already materialised stay with the person (service
 * contract), so the copy says exactly that.
 */
export function CategoryMembers({
  categoryId,
  categoryName,
  members,
  choices,
  memberQuery,
  truncated,
  choicesFailure = null,
  retryHref,
  messages,
}: CategoryMembersProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<MutationFailure | null>(null);
  const [pendingRemove, setPendingRemove] = useState<CategoryMemberRow | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<MutationFailure | null>(null);

  const memberIds = new Set(members.map((member) => member.id));
  const available = choices.filter((choice) => !memberIds.has(choice.id));

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const userId = String(data.get("userId") ?? "");
    if (!userId) return;

    setAdding(true);
    setAddError(null);
    const result = await addCategoryMember(categoryId, userId);
    setAdding(false);
    if (!result.ok) {
      setAddError(result);
      return;
    }
    router.refresh();
  }

  async function handleRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    setRemoveError(null);
    const result = await removeCategoryMember(categoryId, pendingRemove.id);
    setRemoving(false);
    if (!result.ok) {
      setRemoveError(result);
      return;
    }
    dialogRef.current?.close();
    setPendingRemove(null);
    router.refresh();
  }

  function openRemove(member: CategoryMemberRow) {
    setRemoveError(null);
    setPendingRemove(member);
    dialogRef.current?.showModal();
  }

  function closeRemove() {
    dialogRef.current?.close();
    setPendingRemove(null);
  }

  return (
    <section
      aria-labelledby="category-members-title"
      className="flex max-w-md flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="category-members-title" className="text-sm font-semibold">
        {t("Members", messages)}
      </h2>

      <form method="get" role="search" className="flex flex-wrap items-end gap-2">
        <label htmlFor="category-member-q" className="flex flex-col gap-1 text-xs font-semibold">
          {t("Search members", messages)}
          <input
            id="category-member-q"
            name="memberQ"
            type="search"
            defaultValue={memberQuery}
            maxLength={100}
            className={inputClass}
          />
        </label>
        <Button type="submit" variant="secondary" className="min-h-11">
          {t("Search", messages)}
        </Button>
      </form>

      {truncated && (
        <p className="text-xs text-muted-foreground">
          {t("Only the first 100 matches are shown. Narrow the search to find someone.", messages)}
        </p>
      )}

      <MemberList members={members} onRemove={openRemove} messages={messages} />

      <AddMemberForm
        available={available}
        memberQuery={memberQuery}
        adding={adding}
        choicesFailure={choicesFailure}
        retryHref={retryHref}
        onSubmit={handleAdd}
        messages={messages}
      />

      {addError && (
        <MutationAlert
          title={t("We couldn't add the member.", messages)}
          error={addError}
          messages={messages}
        />
      )}

      <RemoveMemberDialog
        dialogRef={dialogRef}
        pending={pendingRemove}
        categoryName={categoryName}
        removing={removing}
        error={removeError}
        onCancel={closeRemove}
        onConfirm={handleRemove}
        messages={messages}
      />
    </section>
  );
}

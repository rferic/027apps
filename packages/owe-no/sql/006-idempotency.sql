-- 1.7.0 — idempotency keys.
--
-- A phone on a bad connection sends "save this expense", the server commits it
-- and the reply is lost; the client retries and the expense lands twice. The
-- client sends an `Idempotency-Key` per write; the same key with the same body
-- returns the original result and creates nothing.

create table owe_no_idempotency (
  group_id uuid not null references owe_no_groups(id) on delete cascade,
  key text not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (group_id, key)
);

alter table owe_no_idempotency enable row level security;

-- A key belongs to the group it was used in; members may read their own group's
-- rows (they hold no amount, only a hash and the answer the client already got).
create policy owe_no_idempotency_read on owe_no_idempotency
  for select using (is_group_active_member(group_id));

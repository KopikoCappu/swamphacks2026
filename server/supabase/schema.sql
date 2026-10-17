-- InkBuddy sync schema. Notes and folders are stored as JSON documents, one row per item, per user.
-- Sync is last-write-wins on `updated_at` (client clock, ms). Deletions are tombstones (`deleted = true`).

create table if not exists public.sync_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('note', 'folder')),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null,
  deleted boolean not null default false,
  primary key (user_id, kind, id)
);

create index if not exists sync_items_user_updated on public.sync_items (user_id, updated_at);

-- Row level security: every user sees and changes only their own rows.
alter table public.sync_items enable row level security;

drop policy if exists "own rows: select" on public.sync_items;
drop policy if exists "own rows: insert" on public.sync_items;
drop policy if exists "own rows: update" on public.sync_items;
drop policy if exists "own rows: delete" on public.sync_items;

create policy "own rows: select" on public.sync_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.sync_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.sync_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.sync_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- New tables are not exposed to the Data API automatically: grant signed-in users access (RLS still applies).
revoke all on public.sync_items from anon;
grant select, insert, update, delete on public.sync_items to authenticated;
-- Default privileges also hand out TRUNCATE (which bypasses RLS), REFERENCES and TRIGGER — take them back.
revoke truncate, references, trigger on public.sync_items from authenticated;

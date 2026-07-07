-- ============================================================================
-- Retriever Nest — Supabase schema, RLS policies, and helper functions
-- Run this whole file once in the Supabase SQL editor (or via `supabase db push`)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- One row per auth user. Auto-populated by a trigger on auth.users (below).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- A "couple" shared space. Has a 6-char invite code the partner uses to join.
create table if not exists public.couple_workspaces (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

-- Membership join table. MVP caps a workspace at 2 members (enforced in join_workspace()).
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  unique (user_id) -- MVP: one user belongs to exactly one workspace
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  title text not null,
  due_date date not null default current_date,
  is_done boolean not null default false,
  -- NULL = shared "both"; otherwise the specific user_id this todo is assigned to.
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists todos_workspace_due_idx on public.todos (workspace_id, due_date);
create index if not exists notes_workspace_created_idx on public.notes (workspace_id, created_at desc);
create index if not exists workspace_members_workspace_idx on public.workspace_members (workspace_id);

-- ----------------------------------------------------------------------------
-- profiles auto-creation trigger
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Helper: is the current user a member of the given workspace?
-- security definer + fixed search_path so it can be used safely inside RLS
-- policies without recursive RLS evaluation issues.
-- ----------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- RPC: create_workspace()
-- Creates a new workspace with a random 6-char invite code and joins the
-- caller to it. If the caller already belongs to a workspace, returns that
-- one instead (idempotent).
-- ----------------------------------------------------------------------------
create or replace function public.create_workspace()
returns public.couple_workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_workspace_id uuid;
  v_workspace public.couple_workspaces;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select workspace_id into v_existing_workspace_id
  from public.workspace_members
  where user_id = auth.uid();

  if v_existing_workspace_id is not null then
    select * into v_workspace from public.couple_workspaces where id = v_existing_workspace_id;
    return v_workspace;
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.couple_workspaces where invite_code = v_code);
  end loop;

  insert into public.couple_workspaces (invite_code) values (v_code)
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id)
  values (v_workspace.id, auth.uid());

  return v_workspace;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: join_workspace(p_invite_code)
-- Joins the caller to the workspace matching the invite code. Idempotent if
-- already a member. Caps membership at 2 (a "couple").
-- ----------------------------------------------------------------------------
create or replace function public.join_workspace(p_invite_code text)
returns public.couple_workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.couple_workspaces;
  v_existing_workspace_id uuid;
  v_member_count int;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select workspace_id into v_existing_workspace_id
  from public.workspace_members
  where user_id = auth.uid();

  select * into v_workspace
  from public.couple_workspaces
  where invite_code = upper(trim(p_invite_code));

  if v_workspace.id is null then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  if v_existing_workspace_id is not null then
    if v_existing_workspace_id = v_workspace.id then
      return v_workspace; -- already a member of this workspace
    else
      raise exception 'ALREADY_IN_ANOTHER_WORKSPACE';
    end if;
  end if;

  select count(*) into v_member_count
  from public.workspace_members
  where workspace_id = v_workspace.id;

  if v_member_count >= 2 then
    raise exception 'WORKSPACE_FULL';
  end if;

  insert into public.workspace_members (workspace_id, user_id)
  values (v_workspace.id, auth.uid());

  return v_workspace;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; without the revokes below the
-- anon role could probe invite codes via join_workspace without logging in.
revoke execute on function public.create_workspace() from public, anon;
revoke execute on function public.join_workspace(text) from public, anon;
revoke execute on function public.is_workspace_member(uuid) from public, anon;

grant execute on function public.create_workspace() to authenticated;
grant execute on function public.join_workspace(text) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.couple_workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.todos enable row level security;
alter table public.notes enable row level security;

-- profiles: see your own profile, and your workspace partner's profile
drop policy if exists "profiles_select_self_or_partner" on public.profiles;
create policy "profiles_select_self_or_partner" on public.profiles
  for select
  using (
    id = auth.uid()
    or id in (
      select wm.user_id from public.workspace_members wm
      where wm.workspace_id in (
        select workspace_id from public.workspace_members where user_id = auth.uid()
      )
    )
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update
  using (id = auth.uid());

-- couple_workspaces: only members can read; writes happen via security-definer RPCs
drop policy if exists "workspaces_select_member" on public.couple_workspaces;
create policy "workspaces_select_member" on public.couple_workspaces
  for select
  using (public.is_workspace_member(id));

-- workspace_members: members can see the roster of their own workspace
drop policy if exists "members_select_same_workspace" on public.workspace_members;
create policy "members_select_same_workspace" on public.workspace_members
  for select
  using (public.is_workspace_member(workspace_id));

-- todos: members of a workspace can read/write that workspace's todos
drop policy if exists "todos_select_member" on public.todos;
create policy "todos_select_member" on public.todos
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "todos_insert_member" on public.todos;
create policy "todos_insert_member" on public.todos
  for insert
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "todos_update_member" on public.todos;
create policy "todos_update_member" on public.todos
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "todos_delete_member" on public.todos;
create policy "todos_delete_member" on public.todos
  for delete
  using (public.is_workspace_member(workspace_id));

-- notes: members of a workspace can read/write that workspace's notes
drop policy if exists "notes_select_member" on public.notes;
create policy "notes_select_member" on public.notes
  for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "notes_insert_member" on public.notes;
create policy "notes_insert_member" on public.notes
  for insert
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "notes_delete_member" on public.notes;
create policy "notes_delete_member" on public.notes
  for delete
  using (public.is_workspace_member(workspace_id));

-- ----------------------------------------------------------------------------
-- Realtime: add tables to the supabase_realtime publication (idempotent)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'todos'
  ) then
    alter publication supabase_realtime add table public.todos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;

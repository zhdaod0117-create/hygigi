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

-- ============================================================================
-- Phase 1 (주말커플 확장): 교환일기 · 감정 날씨 · 출퇴근 상태 · 리액션
-- ============================================================================

-- ----------------------------------------------------------------------------
-- diary_questions: seeded question bank for the daily exchange diary
-- ----------------------------------------------------------------------------
create table if not exists public.diary_questions (
  id int primary key,
  content text not null,
  is_active boolean not null default true
);

-- ----------------------------------------------------------------------------
-- diary_entries: one answer per user per day. "Both must write to reveal"
-- is enforced by RLS below, not by the client.
-- ----------------------------------------------------------------------------
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  question_id int not null references public.diary_questions (id),
  content text not null check (char_length(content) between 1 and 2000),
  read_at timestamptz, -- set when the partner first reads this entry
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, entry_date)
);

-- ----------------------------------------------------------------------------
-- mood_logs: one-tap weather check-ins. Append-only (no updates).
-- ----------------------------------------------------------------------------
create table if not exists public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  mood text not null check (mood in ('sunny', 'partly', 'cloudy', 'rainy', 'stormy')),
  note text check (note is null or char_length(note) <= 80),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- work_status_logs: one-tap work status. Latest row per user = current status.
-- ----------------------------------------------------------------------------
create table if not exists public.work_status_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('working', 'off', 'overtime', 'meeting')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- reactions: single-emoji reactions on diary entries / mood logs (and later
-- notes/todos). One reaction per user per target; re-reacting replaces it.
-- ----------------------------------------------------------------------------
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('diary_entry', 'mood_log', 'note', 'todo')),
  target_id uuid not null,
  emoji text not null check (emoji in ('❤️', '😂', '😭', '👍', '🥺', '🎉')),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists diary_entries_workspace_date_idx on public.diary_entries (workspace_id, entry_date desc);
create index if not exists mood_logs_workspace_created_idx on public.mood_logs (workspace_id, created_at desc);
create index if not exists work_status_workspace_created_idx on public.work_status_logs (workspace_id, created_at desc);
create index if not exists reactions_target_idx on public.reactions (target_type, target_id);

-- ----------------------------------------------------------------------------
-- Helper: does the CALLER have a diary entry for this workspace+date?
-- security definer to avoid recursive RLS evaluation on diary_entries.
-- ----------------------------------------------------------------------------
create or replace function public.has_own_diary_entry(p_workspace_id uuid, p_entry_date date)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.diary_entries
    where workspace_id = p_workspace_id
      and entry_date = p_entry_date
      and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- RPC: has the PARTNER written today's entry? (visible even while my own
-- entry is missing, so the UI can show "상대방이 먼저 썼어요" without
-- exposing the content itself)
-- ----------------------------------------------------------------------------
create or replace function public.diary_partner_written(p_workspace_id uuid, p_entry_date date)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null or not public.is_workspace_member(p_workspace_id) then
    return false;
  end if;
  return exists (
    select 1 from public.diary_entries
    where workspace_id = p_workspace_id
      and entry_date = p_entry_date
      and user_id <> auth.uid()
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: mark the partner's entry as read (only non-authors of revealed
-- entries; first read wins)
-- ----------------------------------------------------------------------------
create or replace function public.mark_diary_read(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  update public.diary_entries e
  set read_at = now()
  where e.id = p_entry_id
    and e.user_id <> auth.uid()
    and e.read_at is null
    and public.is_workspace_member(e.workspace_id)
    and public.has_own_diary_entry(e.workspace_id, e.entry_date); -- only after reveal
end;
$$;

revoke execute on function public.has_own_diary_entry(uuid, date) from public, anon;
revoke execute on function public.diary_partner_written(uuid, date) from public, anon;
revoke execute on function public.mark_diary_read(uuid) from public, anon;
grant execute on function public.has_own_diary_entry(uuid, date) to authenticated;
grant execute on function public.diary_partner_written(uuid, date) to authenticated;
grant execute on function public.mark_diary_read(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- RLS for Phase 1 tables
-- ----------------------------------------------------------------------------
alter table public.diary_questions enable row level security;
alter table public.diary_entries enable row level security;
alter table public.mood_logs enable row level security;
alter table public.work_status_logs enable row level security;
alter table public.reactions enable row level security;

-- diary_questions: read-only bank for any logged-in user
drop policy if exists "diary_questions_select" on public.diary_questions;
create policy "diary_questions_select" on public.diary_questions
  for select to authenticated
  using (is_active);

-- diary_entries: my rows always; partner rows ONLY once I have written the
-- same day's entry (the "both must write" reveal rule, enforced in the DB)
drop policy if exists "diary_select_own_or_revealed" on public.diary_entries;
create policy "diary_select_own_or_revealed" on public.diary_entries
  for select
  using (
    user_id = auth.uid()
    or (
      public.is_workspace_member(workspace_id)
      and public.has_own_diary_entry(workspace_id, entry_date)
    )
  );

-- write own entry, today (KST) only
drop policy if exists "diary_insert_own_today" on public.diary_entries;
create policy "diary_insert_own_today" on public.diary_entries
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and user_id = auth.uid()
    and entry_date = (now() at time zone 'Asia/Seoul')::date
  );

drop policy if exists "diary_update_own_today" on public.diary_entries;
create policy "diary_update_own_today" on public.diary_entries
  for update
  using (user_id = auth.uid() and entry_date = (now() at time zone 'Asia/Seoul')::date)
  with check (user_id = auth.uid() and entry_date = (now() at time zone 'Asia/Seoul')::date);

drop policy if exists "diary_delete_own" on public.diary_entries;
create policy "diary_delete_own" on public.diary_entries
  for delete
  using (user_id = auth.uid());

-- mood_logs: members read all, write own, delete own (no updates)
drop policy if exists "mood_select_member" on public.mood_logs;
create policy "mood_select_member" on public.mood_logs
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "mood_insert_own" on public.mood_logs;
create policy "mood_insert_own" on public.mood_logs
  for insert with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "mood_delete_own" on public.mood_logs;
create policy "mood_delete_own" on public.mood_logs
  for delete using (user_id = auth.uid());

-- work_status_logs: members read all, write own (append-only)
drop policy if exists "status_select_member" on public.work_status_logs;
create policy "status_select_member" on public.work_status_logs
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "status_insert_own" on public.work_status_logs;
create policy "status_insert_own" on public.work_status_logs
  for insert with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

-- reactions: members read all, manage own
drop policy if exists "reactions_select_member" on public.reactions;
create policy "reactions_select_member" on public.reactions
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "reactions_insert_own" on public.reactions;
create policy "reactions_insert_own" on public.reactions
  for insert with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "reactions_update_own" on public.reactions;
create policy "reactions_update_own" on public.reactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "reactions_delete_own" on public.reactions;
create policy "reactions_delete_own" on public.reactions
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Seed: 90 daily questions (idempotent — existing ids are skipped)
-- ----------------------------------------------------------------------------
insert into public.diary_questions (id, content) values
  (1, '오늘 하루 중 제일 뿌듯했던 순간은?'),
  (2, '오늘 나를 웃게 만든 건 뭐였어?'),
  (3, '오늘 하루를 음식 하나로 표현한다면?'),
  (4, '요즘 출근길에 주로 무슨 생각을 해?'),
  (5, '오늘 회사에서 제일 어이없었던 일은?'),
  (6, '지금 당장 같이 먹고 싶은 야식은?'),
  (7, '오늘의 나에게 점수를 준다면? 이유도!'),
  (8, '요즘 제일 자주 듣는 노래는 뭐야?'),
  (9, '이번 주말에 꼭 같이 하고 싶은 것 하나는?'),
  (10, '요즘 스트레스 푸는 나만의 방법은?'),
  (11, '오늘 점심 뭐 먹었어? 맛은 어땠어?'),
  (12, '지금 제일 사고 싶은 물건은 뭐야?'),
  (13, '오늘 들은 말 중에 기억에 남는 한마디는?'),
  (14, '요즘 회사에서 제일 힘든 건 뭐야?'),
  (15, '우리가 처음 만난 날, 제일 기억나는 장면은?'),
  (16, '내가 요즘 잘하고 있는 것 같은 점 하나는?'),
  (17, '오늘 하늘 봤어? 어땠어?'),
  (18, '요즘 퇴근하고 집에 가면 제일 먼저 뭐 해?'),
  (19, '갑자기 하루 휴가가 생기면 뭐 하고 싶어?'),
  (20, '오늘 나에게 어울리는 이모지 3개는?'),
  (21, '요즘 나의 최애 간식은?'),
  (22, '어릴 때 꿈은 뭐였어? 지금 생각하면 어때?'),
  (23, '오늘 제일 오래 머문 장소는 어디였어?'),
  (24, '나의 오늘 체력은 몇 퍼센트였어?'),
  (25, '요즘 배우고 싶은 게 있다면?'),
  (26, '오늘 하루 중 시간을 되돌리고 싶은 순간은?'),
  (27, '상대방이 요즘 제일 예뻐/멋져 보일 때는?'),
  (28, '우리 다음 여행지는 어디면 좋겠어?'),
  (29, '오늘 회사에서 칭찬받을 만한 일 했어?'),
  (30, '요즘 자기 전에 주로 뭘 해?'),
  (31, '오늘의 날씨가 내 기분이랑 어울렸어?'),
  (32, '최근에 본 것 중 제일 웃긴 짤/영상은?'),
  (33, '한 달 월급이 두 배가 되면 제일 먼저 뭐 할래?'),
  (34, '오늘 마신 커피/음료는 몇 잔? 뭐 마셨어?'),
  (35, '요즘 제일 기대되는 일은 뭐야?'),
  (36, '오늘 걸은 걸음 수 확인해봐! 몇 보야?'),
  (37, '내가 요즘 제일 고마운 사람은 누구야?'),
  (38, '스트레스 받을 때 제일 듣고 싶은 말은?'),
  (39, '우리가 같이 살면 제일 먼저 사고 싶은 가구는?'),
  (40, '오늘 점심시간에 뭐 했어?'),
  (41, '요즘 제일 재밌게 보는 콘텐츠는?'),
  (42, '오늘 하루를 색깔로 표현한다면?'),
  (43, '회사에서 도망치고 싶었던 순간 있었어?'),
  (44, '지금 냉장고에 제일 필요한 건 뭐야?'),
  (45, '오늘 나를 제일 지치게 한 건 뭐였어?'),
  (46, '주말에 늦잠 vs 일찍 일어나서 놀기, 이번 주는?'),
  (47, '요즘 내 통장 상태를 한 단어로?'),
  (48, '오늘 처음 안 사실이나 새로 배운 게 있어?'),
  (49, '상대방한테 요즘 제일 궁금한 것 하나만!'),
  (50, '오늘 저녁 메뉴 추천해줘! 뭐 먹을까?'),
  (51, '요즘 아침에 일어나는 게 어때? 쉬워, 어려워?'),
  (52, '갑자기 생각나는 우리의 추억 하나는?'),
  (53, '오늘 회의는 몇 개였어? 제일 길었던 건?'),
  (54, '요즘 나의 소확행은 뭐야?'),
  (55, '올해가 절반 지났어. 상반기 최고의 순간은?'),
  (56, '오늘 옷 뭐 입고 갔어? 잘 어울렸어?'),
  (57, '지금 제일 가고 싶은 카페나 맛집은?'),
  (58, '요즘 운동하고 있어? 몸 상태는 어때?'),
  (59, '내일이 제발 안 왔으면 좋겠어, 빨리 왔으면 좋겠어?'),
  (60, '오늘 지하철/버스에서 무슨 생각 했어?'),
  (61, '요즘 제일 부러운 사람은 누구야?'),
  (62, '오늘 하루 중 제일 조용했던 순간은?'),
  (63, '우리 100일/1000일에 뭐 하고 싶어?'),
  (64, '오늘 실수한 거 있어? 귀엽게 고백해봐'),
  (65, '요즘 제일 자주 쓰는 앱은 뭐야?'),
  (66, '오늘 나의 집중력은 몇 점이었어?'),
  (67, '겨울/여름 휴가 어디로 가고 싶어?'),
  (68, '오늘 만난 사람 중 제일 인상 깊었던 사람은?'),
  (69, '요즘 머릿속을 제일 많이 차지하는 고민은?'),
  (70, '오늘 하루가 영화라면 제목은 뭘까?'),
  (71, '상대방이 해준 것 중 최근 제일 고마웠던 건?'),
  (72, '오늘 회사 급식/점심 별점은 몇 점?'),
  (73, '요즘 잠은 잘 자? 어젯밤엔 몇 시간 잤어?'),
  (74, '로또 당첨되면 회사에 뭐라고 말할 거야?'),
  (75, '오늘 나에게 상을 준다면 무슨 상?'),
  (76, '요즘 우리에게 제일 필요한 건 뭐라고 생각해?'),
  (77, '오늘 하루 중 상대방 생각난 순간 있었어? 언제?'),
  (78, '평일 저녁에 같이 할 수 있는 걸 하나 정한다면?'),
  (79, '오늘의 TMI 하나 풀어줘!'),
  (80, '지금 책상/가방에서 제일 아끼는 물건은?'),
  (81, '요즘 인생 과제가 있다면 뭐야?'),
  (82, '오늘 먹은 것 중 제일 맛있었던 건?'),
  (83, '10년 뒤 우리는 뭐 하고 있을까?'),
  (84, '오늘 참은 말 있어? 여기서만 살짝 해봐'),
  (85, '요즘 제일 큰 웃음 포인트는 뭐야?'),
  (86, '다음 주말 데이트 코스, 즉흥으로 하나 짜본다면?'),
  (87, '오늘의 나를 동물로 표현하면?'),
  (88, '회사 사람 중에 고마운 사람 한 명 있다면?'),
  (89, '지금 이 순간 제일 하고 싶은 것 딱 하나는?'),
  (90, '오늘 하루, 한 문장으로 정리해본다면?')
on conflict (id) do nothing;

-- ============================================================================
-- Phase 2: 주말 계획 보드 · 오늘의 밥상(사진) · 감정 캘린더
-- ============================================================================

-- ----------------------------------------------------------------------------
-- weekend_wishes: "이번 주말에 하고 싶은 것" 위시리스트.
-- 날짜/담당자 개념이 없어서 todos와 분리 (둘 중 누구든 체크/삭제 가능).
-- ----------------------------------------------------------------------------
create table if not exists public.weekend_wishes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- meal_posts: 오늘 뭐 먹었는지 사진 한 장 + 한 줄.
-- image_path는 storage 'meals' 버킷 내 경로 (workspace_id/uuid.jpg).
-- ----------------------------------------------------------------------------
create table if not exists public.meal_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.couple_workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  image_path text not null,
  caption text check (caption is null or char_length(caption) <= 100),
  created_at timestamptz not null default now()
);

create index if not exists weekend_wishes_workspace_idx on public.weekend_wishes (workspace_id, created_at);
create index if not exists meal_posts_workspace_created_idx on public.meal_posts (workspace_id, created_at desc);

alter table public.weekend_wishes enable row level security;
alter table public.meal_posts enable row level security;

drop policy if exists "wishes_select_member" on public.weekend_wishes;
create policy "wishes_select_member" on public.weekend_wishes
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "wishes_insert_own" on public.weekend_wishes;
create policy "wishes_insert_own" on public.weekend_wishes
  for insert with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "wishes_update_member" on public.weekend_wishes;
create policy "wishes_update_member" on public.weekend_wishes
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "wishes_delete_member" on public.weekend_wishes;
create policy "wishes_delete_member" on public.weekend_wishes
  for delete using (public.is_workspace_member(workspace_id));

drop policy if exists "meals_select_member" on public.meal_posts;
create policy "meals_select_member" on public.meal_posts
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "meals_insert_own" on public.meal_posts;
create policy "meals_insert_own" on public.meal_posts
  for insert with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "meals_delete_own" on public.meal_posts;
create policy "meals_delete_own" on public.meal_posts
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Storage: private 'meals' bucket. Object paths are '<workspace_id>/<uuid>.jpg'
-- so membership can be checked from the first folder segment. Images are
-- served via short-lived signed URLs, never public.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meals', 'meals', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "meals_storage_insert_member" on storage.objects;
create policy "meals_storage_insert_member" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meals'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "meals_storage_select_member" on storage.objects;
create policy "meals_storage_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meals'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "meals_storage_delete_own" on storage.objects;
create policy "meals_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'meals' and owner = auth.uid());

-- ----------------------------------------------------------------------------
-- Realtime: add tables to the supabase_realtime publication (idempotent)
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['todos', 'notes', 'diary_entries', 'mood_logs', 'work_status_logs', 'reactions', 'weekend_wishes', 'meal_posts']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

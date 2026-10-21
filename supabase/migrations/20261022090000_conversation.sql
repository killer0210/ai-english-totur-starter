-- M5: conversation — practice_sessions, messages (docs/backend_schema.md §2.3,
-- §4, §4.1; ADR-003, ADR-004, ADR-005). Signed-in users read their own rows;
-- every write goes through the DB functions below (service_role only).
-- Quota (usage_counters, ai_usage_events) arrives in M6, word missions
-- (session_target_words) in M9.

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario_id uuid not null references public.scenarios (id),
  status text not null default 'active'
    check (status in ('active', 'completed', 'abandoned')),
  english_level_at_start public.english_level not null,
  learner_turn_count int not null default 0,
  feedback_status text not null default 'none'
    check (feedback_status in ('none', 'skipped', 'pending', 'ready', 'failed')),
  feedback_attempts smallint not null default 0 check (feedback_attempts between 0 and 2),
  feedback_started_at timestamptz,
  last_activity_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (id, user_id)
);
create index practice_sessions_user_activity_idx
  on public.practice_sessions (user_id, last_activity_at desc);
create index practice_sessions_scenario_id_idx on public.practice_sessions (scenario_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  -- Order of messages (not created_at). One identity for the table; messages
  -- of a session are read in seq order through messages_session_seq_idx.
  seq bigint generated always as identity,
  session_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  status text not null default 'pending'
    check (status in ('pending', 'ok', 'reply_failed')),
  client_message_id uuid,
  reply_to_message_id uuid references public.messages (id) on delete cascade,
  used_hint boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A message can only belong to a session of the same user.
  foreign key (session_id, user_id)
    references public.practice_sessions (id, user_id) on delete cascade,
  unique (id, user_id),
  unique (session_id, client_message_id),
  unique (reply_to_message_id),
  check (role <> 'user' or (client_message_id is not null and char_length(content) <= 1000)),
  check (role <> 'assistant' or (status = 'ok' and reply_to_message_id is not null))
);
create index messages_session_seq_idx on public.messages (session_id, seq);
create index messages_user_id_idx on public.messages (user_id);

create trigger messages_set_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

alter table public.practice_sessions enable row level security;
alter table public.messages enable row level security;

create policy "read own sessions" on public.practice_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "read own messages" on public.messages
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.practice_sessions, public.messages from anon, authenticated;
grant select on table public.practice_sessions, public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Write path (ADR-005). Every function: security invoker, search_path '',
-- p_user_id first (taken by the server from the verified session), ownership
-- checked inside. Results are jsonb: {"error": "<code>"} for a refused write
-- (codes from backend_schema.md §5), otherwise the outcome and rows.
--
-- Lazy expiry (no cron): a pending user message older than p_stale_ms counts
-- as reply_failed; an active session idle for 24 hours counts as abandoned.
-- Writes persist both; reads apply the same rules in
-- src/features/conversation/state.ts.
-- ---------------------------------------------------------------------------

create function public.message_json(m public.messages)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id,
    'seq', m.seq,
    'role', m.role,
    'content', m.content,
    'status', m.status,
    'client_message_id', m.client_message_id,
    'reply_to_message_id', m.reply_to_message_id,
    'created_at', m.created_at
  )
$$;

create function public.session_json(s public.practice_sessions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'learner_turn_count', s.learner_turn_count,
    'feedback_status', s.feedback_status,
    'last_activity_at', s.last_activity_at,
    'completed_at', s.completed_at
  )
$$;

-- Locks the session row of p_user_id (serialises every write to one session)
-- and applies lazy expiry. Returns null when the session is not the user's.
create function public.lock_session(p_user_id uuid, p_session_id uuid, p_stale_ms int)
returns public.practice_sessions
language plpgsql
set search_path = ''
as $$
declare
  v_session public.practice_sessions;
begin
  select * into v_session
  from public.practice_sessions
  where id = p_session_id and user_id = p_user_id
  for update;
  if not found then
    return null;
  end if;

  if v_session.status = 'active' and v_session.last_activity_at < now() - interval '24 hours' then
    update public.practice_sessions set status = 'abandoned'
    where id = v_session.id
    returning * into v_session;
  end if;

  update public.messages set status = 'reply_failed'
  where session_id = v_session.id
    and status = 'pending'
    and updated_at < now() - make_interval(secs => p_stale_ms / 1000.0);

  return v_session;
end;
$$;

create function public.start_session(p_user_id uuid, p_scenario_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_level public.english_level;
  v_session public.practice_sessions;
begin
  select english_level into v_level
  from public.profiles
  where id = p_user_id and age_confirmed_at is not null and onboarding_completed_at is not null;
  if not found then
    return jsonb_build_object('error', 'FORBIDDEN');
  end if;

  perform 1
  from public.scenarios s
  join public.units u on u.id = s.unit_id
  where s.id = p_scenario_id and s.is_active and u.is_active;
  if not found then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  update public.practice_sessions set status = 'abandoned'
  where user_id = p_user_id
    and status = 'active'
    and last_activity_at < now() - interval '24 hours';

  insert into public.practice_sessions (user_id, scenario_id, english_level_at_start)
  values (p_user_id, p_scenario_id, v_level)
  returning * into v_session;

  return jsonb_build_object('outcome', 'created', 'session', public.session_json(v_session));
end;
$$;

-- Duplicate check → ownership, active, block, turn limit → pending message
-- (architecture.md §4). Quota is added in M6.
create function public.begin_user_turn(
  p_user_id uuid,
  p_session_id uuid,
  p_client_message_id uuid,
  p_content text,
  p_max_turns int,
  p_stale_ms int
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_session public.practice_sessions;
  v_message public.messages;
  v_reply public.messages;
begin
  v_session := public.lock_session(p_user_id, p_session_id, p_stale_ms);
  if v_session.id is null then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  -- The same client_message_id never creates a second message or AI call.
  select * into v_message
  from public.messages
  where session_id = v_session.id and client_message_id = p_client_message_id;
  if found then
    if v_message.status = 'pending' then
      return jsonb_build_object('error', 'IN_PROGRESS');
    end if;
    select * into v_reply from public.messages where reply_to_message_id = v_message.id;
    return jsonb_build_object(
      'outcome', 'duplicate',
      'session', public.session_json(v_session),
      'message', public.message_json(v_message),
      'reply', case when v_reply.id is null then null else public.message_json(v_reply) end
    );
  end if;

  if v_session.status <> 'active' then
    return jsonb_build_object('error', 'SESSION_NOT_ACTIVE');
  end if;

  perform 1 from public.messages
  where session_id = v_session.id and role = 'user' and status in ('pending', 'reply_failed');
  if found then
    return jsonb_build_object('error', 'MESSAGE_BLOCKED');
  end if;

  if v_session.learner_turn_count >= p_max_turns then
    return jsonb_build_object('error', 'TURN_LIMIT_REACHED');
  end if;

  insert into public.messages (session_id, user_id, role, content, status, client_message_id)
  values (v_session.id, p_user_id, 'user', p_content, 'pending', p_client_message_id)
  returning * into v_message;

  update public.practice_sessions
  set learner_turn_count = learner_turn_count + 1, last_activity_at = now()
  where id = v_session.id
  returning * into v_session;

  return jsonb_build_object(
    'outcome', 'created',
    'session', public.session_json(v_session),
    'message', public.message_json(v_message)
  );
end;
$$;

-- reply_failed → pending for one more provider call. Not a new turn.
create function public.begin_retry(
  p_user_id uuid,
  p_session_id uuid,
  p_message_id uuid,
  p_stale_ms int
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_session public.practice_sessions;
  v_message public.messages;
  v_reply public.messages;
begin
  v_session := public.lock_session(p_user_id, p_session_id, p_stale_ms);
  if v_session.id is null then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  select * into v_message
  from public.messages
  where id = p_message_id and session_id = v_session.id and role = 'user';
  if not found then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  if v_session.status <> 'active' then
    return jsonb_build_object('error', 'SESSION_NOT_ACTIVE');
  end if;

  if v_message.status = 'pending' then
    return jsonb_build_object('error', 'IN_PROGRESS');
  end if;

  if v_message.status = 'ok' then
    -- Already answered (e.g. a repeated retry): return the stored reply.
    select * into v_reply from public.messages where reply_to_message_id = v_message.id;
    return jsonb_build_object(
      'outcome', 'duplicate',
      'session', public.session_json(v_session),
      'message', public.message_json(v_message),
      'reply', public.message_json(v_reply)
    );
  end if;

  update public.messages set status = 'pending'
  where id = v_message.id
  returning * into v_message;

  update public.practice_sessions set last_activity_at = now()
  where id = v_session.id
  returning * into v_session;

  return jsonb_build_object(
    'outcome', 'retrying',
    'session', public.session_json(v_session),
    'message', public.message_json(v_message)
  );
end;
$$;

-- Stores the reply (message → ok) or, with p_reply null, marks reply_failed.
-- Only a pending message changes; anything else returns the current rows.
create function public.finish_user_turn(p_user_id uuid, p_message_id uuid, p_reply text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_message public.messages;
  v_reply public.messages;
  v_session public.practice_sessions;
begin
  select * into v_message
  from public.messages
  where id = p_message_id and user_id = p_user_id and role = 'user'
  for update;
  if not found then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  if v_message.status = 'pending' then
    if p_reply is null then
      update public.messages set status = 'reply_failed'
      where id = v_message.id
      returning * into v_message;
    else
      insert into public.messages (session_id, user_id, role, content, status, reply_to_message_id)
      values (v_message.session_id, p_user_id, 'assistant', p_reply, 'ok', v_message.id)
      returning * into v_reply;

      update public.messages set status = 'ok'
      where id = v_message.id
      returning * into v_message;
    end if;

    update public.practice_sessions set last_activity_at = now()
    where id = v_message.session_id;
  else
    select * into v_reply from public.messages where reply_to_message_id = v_message.id;
  end if;

  select * into v_session from public.practice_sessions where id = v_message.session_id;
  return jsonb_build_object(
    'outcome', 'finished',
    'session', public.session_json(v_session),
    'message', public.message_json(v_message),
    'reply', case when v_reply.id is null then null else public.message_json(v_reply) end
  );
end;
$$;

-- Idempotent. Fewer than 3 learner messages → feedback_status 'skipped';
-- otherwise feedback_status stays 'none' until feedback arrives (M7).
create function public.complete_session(p_user_id uuid, p_session_id uuid, p_stale_ms int)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_session public.practice_sessions;
  v_learner_messages int;
begin
  v_session := public.lock_session(p_user_id, p_session_id, p_stale_ms);
  if v_session.id is null then
    return jsonb_build_object('error', 'NOT_FOUND');
  end if;

  if v_session.status = 'completed' then
    return jsonb_build_object('outcome', 'duplicate', 'session', public.session_json(v_session));
  end if;
  if v_session.status <> 'active' then
    return jsonb_build_object('error', 'SESSION_NOT_ACTIVE');
  end if;

  perform 1 from public.messages where session_id = v_session.id and status = 'pending';
  if found then
    return jsonb_build_object('error', 'IN_PROGRESS');
  end if;

  select count(*) into v_learner_messages
  from public.messages
  where session_id = v_session.id and role = 'user';

  update public.practice_sessions
  set status = 'completed',
      completed_at = now(),
      last_activity_at = now(),
      feedback_status = case when v_learner_messages < 3 then 'skipped' else feedback_status end
  where id = v_session.id
  returning * into v_session;

  return jsonb_build_object('outcome', 'completed', 'session', public.session_json(v_session));
end;
$$;

-- The default privileges from the profiles migration already withhold EXECUTE
-- from client roles; revoke explicitly as well (backend_schema.md §4.1).
revoke execute on function
  public.message_json(public.messages),
  public.session_json(public.practice_sessions),
  public.lock_session(uuid, uuid, int),
  public.start_session(uuid, uuid),
  public.begin_user_turn(uuid, uuid, uuid, text, int, int),
  public.begin_retry(uuid, uuid, uuid, int),
  public.finish_user_turn(uuid, uuid, text),
  public.complete_session(uuid, uuid, int)
from public, anon, authenticated;

-- security invoker: the helpers run as the caller (service_role) too.
grant execute on function
  public.message_json(public.messages),
  public.session_json(public.practice_sessions),
  public.lock_session(uuid, uuid, int),
  public.start_session(uuid, uuid),
  public.begin_user_turn(uuid, uuid, uuid, text, int, int),
  public.begin_retry(uuid, uuid, uuid, int),
  public.finish_user_turn(uuid, uuid, text),
  public.complete_session(uuid, uuid, int)
to service_role;

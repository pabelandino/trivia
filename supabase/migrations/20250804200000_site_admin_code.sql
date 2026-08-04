-- Site-wide admin access code (hashed, no email required)
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  access_code_hash text not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (access_code_hash)
values (extensions.crypt('trivia2024', extensions.gen_salt('bf')))
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

create or replace function public.assert_site_admin(p_site_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_site_code is null or length(trim(p_site_code)) = 0 then
    raise exception 'Admin access code required';
  end if;

  if not exists (
    select 1
    from public.site_settings
    where access_code_hash = extensions.crypt(trim(p_site_code), access_code_hash)
  ) then
    raise exception 'Invalid admin access code';
  end if;
end;
$$;

create or replace function public.verify_site_admin(p_site_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_site_admin(p_site_code);
  return jsonb_build_object('valid', true);
exception
  when others then
    raise exception 'Invalid admin access code';
end;
$$;

create or replace function public.change_site_admin_code(
  p_current_code text,
  p_new_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_site_admin(p_current_code);

  if p_new_code is null or length(trim(p_new_code)) < 4 then
    raise exception 'New code must be at least 4 characters';
  end if;

  update public.site_settings
  set access_code_hash = extensions.crypt(trim(p_new_code), extensions.gen_salt('bf')),
      updated_at = now()
  where id = 1;

  return jsonb_build_object('changed', true);
end;
$$;

grant execute on function public.verify_site_admin(text) to anon, authenticated;
grant execute on function public.change_site_admin_code(text, text) to anon, authenticated;

-- Recreate admin RPCs with site code check

create or replace function public.create_game(
  p_site_code text,
  p_title text default 'Trivia Night',
  p_default_timer integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  v_code text;
  v_secret text;
begin
  perform public.assert_site_admin(p_site_code);

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.games (code, admin_secret, title, default_timer_seconds)
  values (v_code, v_secret, coalesce(nullif(trim(p_title), ''), 'Trivia Night'), p_default_timer)
  returning * into v_game;

  return jsonb_build_object(
    'game', row_to_json(v_game),
    'adminSecret', v_secret,
    'shareUrl', '/play?code=' || v_code
  );
end;
$$;

create or replace function public.add_question(
  p_site_code text,
  p_game_id uuid,
  p_admin_secret text,
  p_question_text text,
  p_options jsonb,
  p_correct_index integer,
  p_timer_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  v_question public.questions%rowtype;
  v_count integer;
begin
  perform public.assert_site_admin(p_site_code);
  if not public.verify_admin(p_game_id, p_admin_secret) then raise exception 'Unauthorized'; end if;
  select * into v_game from public.games where id = p_game_id;
  if v_game.phase <> 'setup' then raise exception 'Questions can only be added during setup'; end if;
  select count(*) into v_count from public.questions where game_id = p_game_id;
  insert into public.questions (game_id, order_index, question_text, options, correct_index, timer_seconds)
  values (p_game_id, v_count, trim(p_question_text), p_options, p_correct_index, p_timer_seconds)
  returning * into v_question;
  return jsonb_build_object('question', row_to_json(v_question));
end;
$$;

create or replace function public.update_question(
  p_site_code text,
  p_game_id uuid,
  p_question_id uuid,
  p_admin_secret text,
  p_question_text text,
  p_options jsonb,
  p_correct_index integer,
  p_timer_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  v_question public.questions%rowtype;
begin
  perform public.assert_site_admin(p_site_code);
  if not public.verify_admin(p_game_id, p_admin_secret) then raise exception 'Unauthorized'; end if;
  select * into v_game from public.games where id = p_game_id;
  if v_game.phase <> 'setup' then raise exception 'Questions can only be edited during setup'; end if;
  update public.questions
  set question_text = trim(p_question_text), options = p_options, correct_index = p_correct_index, timer_seconds = p_timer_seconds
  where id = p_question_id and game_id = p_game_id returning * into v_question;
  if not found then raise exception 'Question not found'; end if;
  return jsonb_build_object('question', row_to_json(v_question));
end;
$$;

create or replace function public.delete_question(
  p_site_code text,
  p_game_id uuid,
  p_question_id uuid,
  p_admin_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  rec record;
  idx integer := 0;
begin
  perform public.assert_site_admin(p_site_code);
  if not public.verify_admin(p_game_id, p_admin_secret) then raise exception 'Unauthorized'; end if;
  select * into v_game from public.games where id = p_game_id;
  if v_game.phase <> 'setup' then raise exception 'Questions can only be deleted during setup'; end if;
  delete from public.questions where id = p_question_id and game_id = p_game_id;
  if not found then raise exception 'Question not found'; end if;
  for rec in select id from public.questions where game_id = p_game_id order by order_index loop
    update public.questions set order_index = idx where id = rec.id;
    idx := idx + 1;
  end loop;
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.update_game_settings(
  p_site_code text,
  p_game_id uuid,
  p_admin_secret text,
  p_title text default null,
  p_default_timer integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
begin
  perform public.assert_site_admin(p_site_code);
  if not public.verify_admin(p_game_id, p_admin_secret) then raise exception 'Unauthorized'; end if;
  update public.games
  set title = coalesce(nullif(trim(p_title), ''), title),
      default_timer_seconds = coalesce(p_default_timer, default_timer_seconds)
  where id = p_game_id returning * into v_game;
  return jsonb_build_object('game', row_to_json(v_game));
end;
$$;

create or replace function public.delete_game(
  p_site_code text,
  p_game_id uuid,
  p_admin_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.assert_site_admin(p_site_code);
  if not public.verify_admin(p_game_id, p_admin_secret) then raise exception 'Unauthorized'; end if;
  delete from public.games where id = p_game_id;
  return jsonb_build_object('deleted', true);
end;
$$;

create or replace function public.restart_game(
  p_site_code text,
  p_game_id uuid,
  p_admin_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
begin
  perform public.assert_site_admin(p_site_code);
  if not public.verify_admin(p_game_id, p_admin_secret) then raise exception 'Unauthorized'; end if;
  delete from public.answers where question_id in (select id from public.questions where game_id = p_game_id);
  update public.participants set score = 0 where game_id = p_game_id;
  update public.games set phase = 'lobby', current_question_index = -1, question_started_at = null, reveal_started_at = null
  where id = p_game_id returning * into v_game;
  return jsonb_build_object('game', row_to_json(v_game));
end;
$$;

create or replace function public.game_control(
  p_site_code text,
  p_game_id uuid,
  p_admin_secret text,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  v_question public.questions%rowtype;
  v_next_index integer;
  v_answer record;
  v_now timestamptz := now();
begin
  perform public.assert_site_admin(p_site_code);
  if not public.verify_admin(p_game_id, p_admin_secret) then raise exception 'Unauthorized'; end if;
  select * into v_game from public.games where id = p_game_id;

  if p_action = 'restart' then
    return public.restart_game(p_site_code, p_game_id, p_admin_secret);
  end if;

  if (select count(*) from public.questions where game_id = p_game_id) = 0 then
    raise exception 'Add at least one question before starting';
  end if;

  if p_action = 'open_lobby' then
    if v_game.phase <> 'setup' then raise exception 'Lobby can only be opened from setup'; end if;
    update public.games set phase = 'lobby', current_question_index = -1 where id = p_game_id returning * into v_game;
    return jsonb_build_object('game', row_to_json(v_game));
  end if;

  if p_action = 'reveal' then
    if v_game.phase <> 'question' then raise exception 'Can only reveal during an active question'; end if;
    select * into v_question from public.questions where game_id = p_game_id and order_index = v_game.current_question_index;
    if not found then raise exception 'Current question not found'; end if;
    for v_answer in select id, participant_id, selected_index from public.answers where question_id = v_question.id loop
      update public.answers set is_correct = (v_answer.selected_index = v_question.correct_index) where id = v_answer.id;
      if v_answer.selected_index = v_question.correct_index then
        perform public.increment_participant_score(v_answer.participant_id);
      end if;
    end loop;
    update public.games set phase = 'reveal', reveal_started_at = v_now, question_started_at = null where id = p_game_id returning * into v_game;
    return jsonb_build_object('game', row_to_json(v_game));
  end if;

  if p_action in ('start_question', 'auto_advance') and v_game.phase = 'reveal' then
    v_next_index := v_game.current_question_index + 1;
    if v_next_index >= (select count(*) from public.questions where game_id = p_game_id) then
      update public.games set phase = 'finished', reveal_started_at = null, question_started_at = null where id = p_game_id returning * into v_game;
      return jsonb_build_object('game', row_to_json(v_game), 'finished', true);
    end if;
    update public.games set phase = 'question', current_question_index = v_next_index, question_started_at = v_now, reveal_started_at = null where id = p_game_id returning * into v_game;
    return jsonb_build_object('game', row_to_json(v_game), 'finished', false);
  end if;

  if p_action in ('start_question', 'auto_advance') and v_game.phase = 'lobby' then
    update public.games set phase = 'question', current_question_index = 0, question_started_at = v_now, reveal_started_at = null where id = p_game_id returning * into v_game;
    return jsonb_build_object('game', row_to_json(v_game), 'finished', false);
  end if;

  if p_action = 'auto_advance' and v_game.phase = 'question' then
    return public.game_control(p_site_code, p_game_id, p_admin_secret, 'reveal');
  end if;

  raise exception 'Unknown action or invalid phase';
end;
$$;

grant execute on function public.create_game(text, text, integer) to anon, authenticated;
grant execute on function public.add_question(text, uuid, text, text, jsonb, integer, integer) to anon, authenticated;
grant execute on function public.update_question(text, uuid, uuid, text, text, jsonb, integer, integer) to anon, authenticated;
grant execute on function public.delete_question(text, uuid, uuid, text) to anon, authenticated;
grant execute on function public.update_game_settings(text, uuid, text, text, integer) to anon, authenticated;
grant execute on function public.delete_game(text, uuid, text) to anon, authenticated;
grant execute on function public.restart_game(text, uuid, text) to anon, authenticated;
grant execute on function public.game_control(text, uuid, text, text) to anon, authenticated;

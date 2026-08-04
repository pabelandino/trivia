create or replace function public.increment_participant_score(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.participants
  set score = score + 1
  where id = p_participant_id;
end;
$$;

revoke all on function public.increment_participant_score(uuid) from public;
grant execute on function public.increment_participant_score(uuid) to service_role;

begin;

alter table public.profiles
add column if not exists locale text not null default 'zh-CN'
check (locale in ('zh-CN', 'en-US'));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'GroundDesk user'), '@', 1)
    ),
    case
      when new.raw_user_meta_data ->> 'locale' in ('zh-CN', 'en-US')
        then new.raw_user_meta_data ->> 'locale'
      else 'zh-CN'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, display_name, locale)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    split_part(coalesce(users.email, 'GroundDesk user'), '@', 1)
  ),
  case
    when users.raw_user_meta_data ->> 'locale' in ('zh-CN', 'en-US')
      then users.raw_user_meta_data ->> 'locale'
    else 'zh-CN'
  end
from auth.users users
on conflict (id) do nothing;

grant usage on schema public to authenticated;
grant select on public.profiles, public.workspaces, public.workspace_members to authenticated;
grant update (display_name, avatar_url, locale) on public.profiles to authenticated;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

commit;

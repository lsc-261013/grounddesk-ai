begin;

alter table public.conversations
  add column if not exists source text not null default 'public_demo'
  check (source in ('public_demo', 'playground', 'evaluation'));

drop index if exists public.conversations_anonymous_session_unique;

create unique index if not exists conversations_anonymous_source_unique
  on public.conversations(workspace_id, anonymous_session_hash, source)
  where anonymous_session_hash is not null;

create index if not exists conversations_workspace_source_created_idx
  on public.conversations(workspace_id, source, created_at desc);

-- Evaluation traffic predating this column can be identified by its bounded run window.
update public.conversations conversation
set source = 'evaluation'
where conversation.source = 'public_demo'
  and exists (
    select 1
    from public.eval_runs run
    where run.workspace_id = conversation.workspace_id
      and conversation.created_at >= run.created_at - interval '5 seconds'
      and conversation.created_at <= coalesce(run.completed_at, now()) + interval '5 seconds'
  );

commit;

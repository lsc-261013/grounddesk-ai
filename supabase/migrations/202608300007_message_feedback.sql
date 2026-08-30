begin;

create table if not exists public.message_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  anonymous_session_hash text not null,
  rating text not null check (rating in ('helpful', 'unhelpful')),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, anonymous_session_hash)
);

create index if not exists message_feedback_workspace_created_idx
  on public.message_feedback(workspace_id, created_at desc);

alter table public.message_feedback enable row level security;

revoke all on public.message_feedback from anon, authenticated;

commit;

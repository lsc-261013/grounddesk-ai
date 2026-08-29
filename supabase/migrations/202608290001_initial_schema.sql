begin;

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm;

create type public.workspace_role as enum ('admin', 'agent');
create type public.document_status as enum ('queued', 'processing', 'ready', 'failed');
create type public.document_kind as enum ('pdf', 'markdown', 'txt');
create type public.order_status as enum ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
create type public.message_role as enum ('user', 'assistant', 'tool', 'system');
create type public.agent_intent as enum (
  'knowledge_answer',
  'order_lookup',
  'return_eligibility',
  'human_handoff'
);
create type public.ticket_status as enum ('open', 'in_progress', 'waiting_customer', 'resolved');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.return_eligibility_status as enum ('eligible', 'ineligible', 'manual_review');
create type public.webhook_delivery_status as enum ('pending', 'delivered', 'failed');
create type public.eval_run_status as enum ('queued', 'running', 'completed', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  default_locale text not null default 'zh-CN' check (default_locale in ('zh-CN', 'en-US')),
  confidence_threshold real not null default 0.62 check (confidence_threshold between 0 and 1),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.embedding_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  model text not null,
  dimensions integer not null check (dimensions = 1024),
  index_version uuid not null default gen_random_uuid(),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, model, index_version)
);

create unique index embedding_configs_one_active_per_workspace
  on public.embedding_configs(workspace_id)
  where is_active;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku text not null,
  model text not null,
  category text not null,
  name_zh text not null,
  name_en text not null,
  description_zh text not null,
  description_en text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  specs jsonb not null default '{}'::jsonb,
  is_returnable boolean not null default true,
  opened_return_policy text not null default 'standard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, sku),
  unique (workspace_id, model)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_number text not null check (order_number ~ '^GD-[A-Z0-9]{8}$'),
  customer_name text not null,
  customer_email text not null,
  status public.order_status not null,
  ordered_at timestamptz not null,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  carrier text,
  tracking_number_masked text,
  shipping_country_code text not null check (shipping_country_code ~ '^[A-Z]{2}$'),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, order_number)
);

create index orders_workspace_email_idx
  on public.orders(workspace_id, lower(customer_email));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 20),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  opened boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create table public.return_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  effective_from date not null,
  effective_to date,
  rules jsonb not null,
  policy_text_zh text not null,
  policy_text_en text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, version),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  original_filename text not null,
  storage_path text not null,
  kind public.document_kind not null,
  language text not null check (language in ('zh-CN', 'en-US', 'bilingual')),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  byte_size bigint not null check (byte_size between 1 and 10485760),
  status public.document_status not null default 'queued',
  failure_code text,
  failure_message text,
  processed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, content_hash),
  check (
    (status = 'failed' and failure_message is not null)
    or (status <> 'failed' and failure_message is null)
  )
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  embedding_config_id uuid references public.embedding_configs(id) on delete restrict,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  token_count integer not null check (token_count > 0),
  page_start integer,
  page_end integer,
  section_path text[] not null default '{}',
  product_models text[] not null default '{}',
  language text not null check (language in ('zh-CN', 'en-US', 'bilingual')),
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1024),
  search_vector tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  unique (document_id, content_hash),
  check ((embedding is null) = (embedding_config_id is null)),
  check (page_start is null or page_start > 0),
  check (page_end is null or page_end >= page_start)
);

create index knowledge_chunks_workspace_idx on public.knowledge_chunks(workspace_id);
create index knowledge_chunks_document_idx on public.knowledge_chunks(document_id);
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin(search_vector);
create index knowledge_chunks_models_idx on public.knowledge_chunks using gin(product_models);
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_user_id uuid references public.profiles(id) on delete set null,
  anonymous_session_hash text,
  locale text not null check (locale in ('zh-CN', 'en-US')),
  status text not null default 'active' check (status in ('active', 'handed_off', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_user_id is not null or anonymous_session_hash is not null)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null,
  intent public.agent_intent,
  refused boolean not null default false,
  handed_off boolean not null default false,
  first_token_latency_ms integer,
  total_latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12, 6),
  provider_request_id text,
  error_type text,
  created_at timestamptz not null default now(),
  check (first_token_latency_ms is null or first_token_latency_ms >= 0),
  check (total_latency_ms is null or total_latency_ms >= 0),
  check (input_tokens is null or input_tokens >= 0),
  check (output_tokens is null or output_tokens >= 0),
  check (estimated_cost_usd is null or estimated_cost_usd >= 0)
);

create index messages_conversation_created_idx
  on public.messages(conversation_id, created_at);

create table public.message_citations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  chunk_id uuid not null references public.knowledge_chunks(id) on delete restrict,
  ordinal integer not null check (ordinal > 0),
  quote text not null,
  created_at timestamptz not null default now(),
  unique (message_id, ordinal),
  unique (message_id, chunk_id)
);

create table public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  tool_name text not null check (tool_name in ('order_lookup', 'return_eligibility')),
  arguments_redacted jsonb not null,
  status text not null check (status in ('started', 'succeeded', 'not_found', 'forbidden', 'failed')),
  result_summary jsonb,
  duration_ms integer,
  error_type text,
  created_at timestamptz not null default now(),
  check (duration_ms is null or duration_ms >= 0)
);

create table public.retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  embedding_config_id uuid not null references public.embedding_configs(id) on delete restrict,
  query_text_redacted text not null,
  candidate_chunk_ids uuid[] not null default '{}',
  final_chunk_ids uuid[] not null default '{}',
  filters jsonb not null default '{}'::jsonb,
  was_empty boolean not null,
  conflict_detected boolean not null default false,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  summary text not null,
  handoff_reason text not null,
  evidence_chunk_ids uuid[] not null default '{}',
  tool_call_ids uuid[] not null default '{}',
  priority public.ticket_priority not null default 'normal',
  status public.ticket_status not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  first_response_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index tickets_workspace_status_idx
  on public.tickets(workspace_id, status, priority, created_at);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_type text not null check (author_type in ('customer', 'agent', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  url text not null,
  encrypted_signing_secret text not null,
  subscribed_events text[] not null default '{}',
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_name text not null,
  payload jsonb not null,
  status public.webhook_delivery_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  response_status integer,
  response_excerpt text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  provider text not null,
  model text not null,
  operation text not null check (operation in ('generation', 'embedding', 'rerank')),
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(12, 6),
  first_token_latency_ms integer,
  total_latency_ms integer,
  provider_usage_available boolean not null default false,
  created_at timestamptz not null default now(),
  check (input_tokens is null or input_tokens >= 0),
  check (output_tokens is null or output_tokens >= 0),
  check (total_tokens is null or total_tokens >= 0),
  check (estimated_cost_usd is null or estimated_cost_usd >= 0)
);

create table public.daily_demo_usage (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  token_count integer not null default 0 check (token_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, usage_date)
);

create table public.eval_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_key text not null,
  category text not null,
  locale text not null check (locale in ('zh-CN', 'en-US')),
  input jsonb not null,
  expected jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, case_key)
);

create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status public.eval_run_status not null default 'queued',
  provider_mode text not null check (provider_mode in ('mock', 'live')),
  git_commit_sha text,
  started_at timestamptz,
  completed_at timestamptz,
  summary jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.eval_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.eval_runs(id) on delete cascade,
  case_id uuid not null references public.eval_cases(id) on delete cascade,
  passed boolean not null,
  actual jsonb not null,
  failures text[] not null default '{}',
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique (run_id, case_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'anonymous', 'system')),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata_redacted jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index audit_logs_workspace_created_idx
  on public.audit_logs(workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_document_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) >= 20
    from public.knowledge_documents
    where workspace_id = new.workspace_id
  ) then
    raise exception 'Workspace document limit of 20 reached' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  required_role public.workspace_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = required_role
  );
$$;

create or replace function public.match_hybrid_chunks(
  target_workspace_id uuid,
  target_embedding_config_id uuid,
  query_embedding extensions.vector(1024),
  query_text text,
  query_language text,
  product_model text default null,
  result_limit integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  section_path text[],
  page_start integer,
  page_end integer,
  fused_score double precision,
  vector_rank bigint,
  keyword_rank bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eligible as (
    select chunk.*
    from public.knowledge_chunks chunk
    where chunk.workspace_id = target_workspace_id
      and chunk.embedding_config_id = target_embedding_config_id
      and chunk.embedding is not null
      and (chunk.language = query_language or chunk.language = 'bilingual')
      and (product_model is null or product_model = any(chunk.product_models))
  ),
  vector_candidates as (
    select
      id,
      row_number() over (order by embedding <=> query_embedding) as rank
    from eligible
    order by embedding <=> query_embedding
    limit greatest(result_limit * 4, 20)
  ),
  keyword_candidates as (
    select
      id,
      row_number() over (
        order by ts_rank_cd(search_vector, websearch_to_tsquery('simple', query_text)) desc
      ) as rank
    from eligible
    where search_vector @@ websearch_to_tsquery('simple', query_text)
    order by ts_rank_cd(search_vector, websearch_to_tsquery('simple', query_text)) desc
    limit greatest(result_limit * 4, 20)
  ),
  fused as (
    select
      coalesce(vector_candidates.id, keyword_candidates.id) as id,
      vector_candidates.rank as vector_rank,
      keyword_candidates.rank as keyword_rank,
      coalesce(1.0 / (60 + vector_candidates.rank), 0.0)
        + coalesce(1.0 / (60 + keyword_candidates.rank), 0.0) as fused_score
    from vector_candidates
    full outer join keyword_candidates using (id)
  )
  select
    eligible.id,
    eligible.document_id,
    eligible.content,
    eligible.section_path,
    eligible.page_start,
    eligible.page_end,
    fused.fused_score,
    fused.vector_rank,
    fused.keyword_rank
  from fused
  join eligible on eligible.id = fused.id
  order by fused.fused_score desc, eligible.id
  limit least(greatest(result_limit, 1), 20);
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger return_policies_set_updated_at before update on public.return_policies
for each row execute function public.set_updated_at();
create trigger knowledge_documents_set_updated_at before update on public.knowledge_documents
for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger tickets_set_updated_at before update on public.tickets
for each row execute function public.set_updated_at();
create trigger webhook_endpoints_set_updated_at before update on public.webhook_endpoints
for each row execute function public.set_updated_at();
create trigger webhook_deliveries_set_updated_at before update on public.webhook_deliveries
for each row execute function public.set_updated_at();
create trigger eval_cases_set_updated_at before update on public.eval_cases
for each row execute function public.set_updated_at();
create trigger enforce_workspace_document_limit before insert on public.knowledge_documents
for each row execute function public.enforce_document_limit();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.embedding_configs enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.return_policies enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_citations enable row level security;
alter table public.tool_calls enable row level security;
alter table public.retrieval_logs enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.daily_demo_usage enable row level security;
alter table public.eval_cases enable row level security;
alter table public.eval_runs enable row level security;
alter table public.eval_results enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_read on public.profiles
for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_member_read on public.workspaces
for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_admin_update on public.workspaces
for update to authenticated using (public.has_workspace_role(id, 'admin'))
with check (public.has_workspace_role(id, 'admin'));

create policy workspace_members_member_read on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy workspace_members_admin_insert on public.workspace_members
for insert to authenticated with check (public.has_workspace_role(workspace_id, 'admin'));
create policy workspace_members_admin_update on public.workspace_members
for update to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy workspace_members_admin_delete on public.workspace_members
for delete to authenticated using (public.has_workspace_role(workspace_id, 'admin'));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'embedding_configs',
    'products',
    'orders',
    'return_policies',
    'knowledge_documents',
    'knowledge_chunks',
    'conversations',
    'messages',
    'message_citations',
    'tool_calls',
    'retrieval_logs',
    'tickets',
    'ticket_messages',
    'webhook_endpoints',
    'webhook_deliveries',
    'ai_usage_events',
    'daily_demo_usage',
    'eval_cases',
    'eval_runs',
    'eval_results',
    'audit_logs'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      table_name || '_member_read',
      table_name
    );
  end loop;
end;
$$;

create policy order_items_member_read on public.order_items
for select to authenticated using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and public.is_workspace_member(orders.workspace_id)
  )
);

create policy products_admin_write on public.products
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy orders_admin_write on public.orders
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy knowledge_documents_admin_write on public.knowledge_documents
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy knowledge_chunks_admin_write on public.knowledge_chunks
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy return_policies_admin_write on public.return_policies
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy embedding_configs_admin_write on public.embedding_configs
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy webhook_endpoints_admin_write on public.webhook_endpoints
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));
create policy eval_cases_admin_write on public.eval_cases
for all to authenticated using (public.has_workspace_role(workspace_id, 'admin'))
with check (public.has_workspace_role(workspace_id, 'admin'));

create policy tickets_member_update on public.tickets
for update to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy ticket_messages_member_insert on public.ticket_messages
for insert to authenticated with check (
  public.is_workspace_member(workspace_id)
  and author_user_id = auth.uid()
  and author_type = 'agent'
);

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, public.workspace_role) to authenticated;
grant execute on function public.match_hybrid_chunks(
  uuid,
  uuid,
  extensions.vector,
  text,
  text,
  text,
  integer
) to authenticated, service_role;

commit;

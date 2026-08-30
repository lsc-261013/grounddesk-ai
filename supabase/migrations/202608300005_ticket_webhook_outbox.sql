begin;

alter table public.webhook_endpoints
  add column if not exists secret_hint text;

create index if not exists webhook_deliveries_due_idx
  on public.webhook_deliveries(status, next_attempt_at, created_at)
  where status in ('pending', 'failed');

create or replace function public.enqueue_webhook_delivery(
  target_workspace_id uuid,
  target_event_name text,
  target_payload jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.webhook_deliveries (
    workspace_id,
    endpoint_id,
    event_name,
    payload,
    status,
    next_attempt_at
  )
  select
    target_workspace_id,
    endpoint.id,
    target_event_name,
    target_payload,
    'pending',
    now()
  from public.webhook_endpoints endpoint
  where endpoint.workspace_id = target_workspace_id
    and endpoint.enabled
    and target_event_name = any(endpoint.subscribed_events);
$$;

revoke all on function public.enqueue_webhook_delivery(uuid, text, jsonb)
from public, anon, authenticated;

create or replace function public.enqueue_ticket_created_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.enqueue_webhook_delivery(
    new.workspace_id,
    'ticket.created',
    jsonb_build_object(
      'ticketId', new.id,
      'conversationId', new.conversation_id,
      'priority', new.priority,
      'status', new.status,
      'handoffReason', new.handoff_reason,
      'occurredAt', new.created_at
    )
  );
  return new;
end;
$$;

create or replace function public.enqueue_ticket_updated_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status
    or old.priority is distinct from new.priority
    or old.assigned_to is distinct from new.assigned_to then
    perform public.enqueue_webhook_delivery(
      new.workspace_id,
      'ticket.updated',
      jsonb_build_object(
        'ticketId', new.id,
        'priority', new.priority,
        'status', new.status,
        'assignedTo', new.assigned_to,
        'occurredAt', new.updated_at
      )
    );
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_ticket_reply_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.enqueue_webhook_delivery(
    new.workspace_id,
    'ticket.reply.created',
    jsonb_build_object(
      'ticketId', new.ticket_id,
      'messageId', new.id,
      'authorType', new.author_type,
      'occurredAt', new.created_at
    )
  );
  return new;
end;
$$;

revoke all on function public.enqueue_ticket_created_webhook()
from public, anon, authenticated;
revoke all on function public.enqueue_ticket_updated_webhook()
from public, anon, authenticated;
revoke all on function public.enqueue_ticket_reply_webhook()
from public, anon, authenticated;

drop trigger if exists tickets_enqueue_created_webhook on public.tickets;
create trigger tickets_enqueue_created_webhook
after insert on public.tickets
for each row execute function public.enqueue_ticket_created_webhook();

drop trigger if exists tickets_enqueue_updated_webhook on public.tickets;
create trigger tickets_enqueue_updated_webhook
after update of status, priority, assigned_to on public.tickets
for each row execute function public.enqueue_ticket_updated_webhook();

drop trigger if exists ticket_messages_enqueue_webhook on public.ticket_messages;
create trigger ticket_messages_enqueue_webhook
after insert on public.ticket_messages
for each row execute function public.enqueue_ticket_reply_webhook();

commit;

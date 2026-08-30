alter table public.products
  add column if not exists is_active boolean not null default true;

create index if not exists products_workspace_active_updated_idx
  on public.products(workspace_id, is_active, updated_at desc);

comment on column public.products.is_active is
  'Controls storefront visibility without deleting products referenced by historical orders.';

begin;

insert into public.workspaces (
  id,
  name,
  slug,
  default_locale,
  confidence_threshold,
  is_demo
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Avenlo Demo Workspace',
  'avenlo-demo',
  'zh-CN',
  0.62,
  true
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  default_locale = excluded.default_locale,
  confidence_threshold = excluded.confidence_threshold,
  is_demo = excluded.is_demo;

insert into public.embedding_configs (
  id,
  workspace_id,
  provider,
  model,
  dimensions,
  index_version,
  is_active
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'siliconflow',
  'BAAI/bge-m3',
  1024,
  '22222222-2222-4222-8222-222222222223',
  true
)
on conflict (id) do update set
  provider = excluded.provider,
  model = excluded.model,
  dimensions = excluded.dimensions,
  index_version = excluded.index_version,
  is_active = excluded.is_active;

insert into public.products (
  id,
  workspace_id,
  sku,
  model,
  category,
  name_zh,
  name_en,
  description_zh,
  description_en,
  price_cents,
  specs,
  is_returnable,
  opened_return_policy
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'AVL-AW-S1-BLK',
    'Airwave S1',
    'wireless_earbuds',
    'Airwave S1 真无线耳机',
    'Airwave S1 True Wireless Earbuds',
    '轻量通勤耳机，支持蓝牙 5.3 与双麦克风通话降噪，不支持多设备同时连接。',
    'Lightweight commuter earbuds with Bluetooth 5.3 and dual-mic call noise reduction. Multipoint is not supported.',
    8900,
    '{"bluetooth":"5.3","multipoint":false,"anc":false,"battery_hours":28,"case":"S1-only","water_resistance":"IPX4"}',
    true,
    'sealed_audio'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '11111111-1111-4111-8111-111111111111',
    'AVL-AW-S1P-GRY',
    'Airwave S1 Pro',
    'wireless_earbuds',
    'Airwave S1 Pro 真无线降噪耳机',
    'Airwave S1 Pro ANC Earbuds',
    '支持自适应主动降噪、蓝牙 5.4 和双设备连接；充电盒与 Airwave S1 不兼容。',
    'Adaptive ANC earbuds with Bluetooth 5.4 and two-device multipoint. The charging case is not compatible with Airwave S1.',
    13900,
    '{"bluetooth":"5.4","multipoint":true,"anc":"adaptive","battery_hours":36,"case":"S1-Pro-only","water_resistance":"IPX5"}',
    true,
    'sealed_audio'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'AVL-OR-H5-NVY',
    'Orbit H5',
    'over_ear_headphones',
    'Orbit H5 头戴式降噪耳机',
    'Orbit H5 Over-Ear ANC Headphones',
    '适合差旅的头戴式耳机，支持有线 USB-C 音频、3.5mm 输入和双设备连接。',
    'Travel-focused headphones with USB-C audio, 3.5 mm input, ANC, and two-device multipoint.',
    18900,
    '{"bluetooth":"5.4","multipoint":true,"anc":"hybrid","battery_hours":55,"wired_audio":["USB-C","3.5mm"]}',
    true,
    'opened_audio_review'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '11111111-1111-4111-8111-111111111111',
    'AVL-FL-67-WHT',
    'Flux 67',
    'gan_charger',
    'Flux 67 三口 GaN 充电器',
    'Flux 67 Triple-Port GaN Charger',
    '双 USB-C 加 USB-A，单口最高 67W；多口同时使用时动态分配功率。',
    'Two USB-C ports plus USB-A with up to 67 W on a single port and dynamic power sharing.',
    5900,
    '{"total_watts":67,"ports":["USB-C1","USB-C2","USB-A"],"protocols":["PD 3.0","PPS","QC 4+"]}',
    true,
    'standard'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '11111111-1111-4111-8111-111111111111',
    'AVL-FL-100-GRY',
    'Flux 100',
    'gan_charger',
    'Flux 100 四口 GaN 充电器',
    'Flux 100 Four-Port GaN Charger',
    '三 USB-C 加 USB-A，USB-C1 单口最高 100W，适合笔记本与移动设备组合充电。',
    'Three USB-C ports plus USB-A. USB-C1 delivers up to 100 W for laptops and mobile devices.',
    8900,
    '{"total_watts":100,"ports":["USB-C1","USB-C2","USB-C3","USB-A"],"protocols":["PD 3.1","PPS","QC 4+"]}',
    true,
    'standard'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '11111111-1111-4111-8111-111111111111',
    'AVL-LC-C240-2M',
    'LinkCore C240',
    'usb_c_cable',
    'LinkCore C240 240W USB-C 线材',
    'LinkCore C240 240 W USB-C Cable',
    '2 米编织线，支持 EPR 240W 供电和 USB 2.0 数据传输，不支持视频输出。',
    'A 2 m braided EPR cable for up to 240 W charging and USB 2.0 data. Video output is not supported.',
    2400,
    '{"length_m":2,"max_watts":240,"data_speed":"USB 2.0 480Mbps","video":false,"e_marker":true}',
    true,
    'standard'
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    '11111111-1111-4111-8111-111111111111',
    'AVL-RS-10K-BLK',
    'Reserve 10K',
    'power_bank',
    'Reserve 10K 移动电源',
    'Reserve 10K Power Bank',
    '额定容量 10,000mAh，USB-C 双向 30W；航空运输需随身携带，不得托运。',
    'A 10,000 mAh power bank with 30 W bidirectional USB-C. Carry-on only for air travel; do not check in.',
    6900,
    '{"capacity_mah":10000,"max_output_watts":30,"air_travel":"carry-on-only","wh":38.5}',
    true,
    'battery_product'
  ),
  (
    '30000000-0000-4000-8000-000000000008',
    '11111111-1111-4111-8111-111111111111',
    'AVL-DL-6-SLV',
    'Dockline 6',
    'desktop_charging_dock',
    'Dockline 6 桌面充电底座',
    'Dockline 6 Desktop Charging Dock',
    '六口桌面供电中心，总功率 200W，支持三台笔记本与移动设备集中充电。',
    'A six-port 200 W desktop power hub for charging up to three laptops and mobile devices.',
    16900,
    '{"total_watts":200,"usb_c_ports":4,"usb_a_ports":2,"display":"power-status-only"}',
    true,
    'standard'
  )
on conflict (id) do update set
  sku = excluded.sku,
  model = excluded.model,
  category = excluded.category,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  description_zh = excluded.description_zh,
  description_en = excluded.description_en,
  price_cents = excluded.price_cents,
  specs = excluded.specs,
  is_returnable = excluded.is_returnable,
  opened_return_policy = excluded.opened_return_policy;

insert into public.return_policies (
  id,
  workspace_id,
  version,
  name,
  effective_from,
  rules,
  policy_text_zh,
  policy_text_en
)
values (
  '40000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  1,
  'Avenlo Demo Return Policy v1',
  current_date - 365,
  '{
    "standard_window_days": 30,
    "sealed_audio_window_days": 14,
    "shipping_damage_report_days": 7,
    "opened_audio_requires_manual_review": true,
    "battery_products_require_ground_return_label": true,
    "final_sale_categories": []
  }',
  '标准商品在签收后 30 天内可申请退货。入耳式耳机拆封后需人工审核；运输损坏应在签收后 7 天内报告。移动电源退回时必须使用指定陆运标签。符合条件只代表可创建待审核申请，不代表已退款。',
  'Standard items may be requested for return within 30 days of delivery. Opened in-ear products require manual review, shipping damage must be reported within 7 days, and power banks require a designated ground-return label. Eligibility creates a pending request; it does not issue a refund.'
)
on conflict (id) do update set
  effective_from = excluded.effective_from,
  rules = excluded.rules,
  policy_text_zh = excluded.policy_text_zh,
  policy_text_en = excluded.policy_text_en;

with generated_orders as (
  select
    series as order_index,
    format('GD-2026D%s', lpad(series::text, 3, '0')) as order_number,
    format('Demo Customer %s', lpad(series::text, 2, '0')) as customer_name,
    format('demo.customer%s@example.com', lpad(series::text, 2, '0')) as customer_email,
    case
      when series between 1 and 5 then 'pending'::public.order_status
      when series between 6 and 10 then 'processing'::public.order_status
      when series between 11 and 17 then 'shipped'::public.order_status
      when series between 18 and 26 then 'delivered'::public.order_status
      else 'cancelled'::public.order_status
    end as status,
    case
      when series between 18 and 22 then current_date - ((series - 17) + 4)
      when series between 23 and 26 then current_date - ((35 + series) + 4)
      else current_date - greatest(1, series % 12)
    end as order_day,
    ((series - 1) % 8) + 1 as product_index
  from generate_series(1, 30) as series
),
prepared_orders as (
  select
    ('50000000-0000-4000-8000-' || lpad(order_index::text, 12, '0'))::uuid as id,
    order_index,
    order_number,
    customer_name,
    customer_email,
    status,
    order_day,
    product_index,
    case product_index
      when 1 then 8900
      when 2 then 13900
      when 3 then 18900
      when 4 then 5900
      when 5 then 8900
      when 6 then 2400
      when 7 then 6900
      else 16900
    end as total_cents
  from generated_orders
)
insert into public.orders (
  id,
  workspace_id,
  order_number,
  customer_name,
  customer_email,
  status,
  ordered_at,
  shipped_at,
  delivered_at,
  cancelled_at,
  carrier,
  tracking_number_masked,
  shipping_country_code,
  total_cents,
  currency,
  is_demo
)
select
  id,
  '11111111-1111-4111-8111-111111111111',
  order_number,
  customer_name,
  customer_email,
  status,
  order_day + time '09:30',
  case when status in ('shipped', 'delivered') then order_day + interval '1 day 7 hours' end,
  case when status = 'delivered' then order_day + interval '4 days 6 hours' end,
  case when status = 'cancelled' then order_day + interval '5 hours' end,
  case when status in ('shipped', 'delivered') then 'ParcelNorth' end,
  case when status in ('shipped', 'delivered') then format('PN••••%s', lpad(order_index::text, 4, '0')) end,
  case order_index % 4 when 0 then 'US' when 1 then 'CN' when 2 then 'GB' else 'DE' end,
  total_cents,
  'USD',
  true
from prepared_orders
on conflict (id) do update set
  status = excluded.status,
  ordered_at = excluded.ordered_at,
  shipped_at = excluded.shipped_at,
  delivered_at = excluded.delivered_at,
  cancelled_at = excluded.cancelled_at,
  carrier = excluded.carrier,
  tracking_number_masked = excluded.tracking_number_masked;

with prepared_items as (
  select
    series as order_index,
    ((series - 1) % 8) + 1 as product_index,
    case ((series - 1) % 8) + 1
      when 1 then 8900
      when 2 then 13900
      when 3 then 18900
      when 4 then 5900
      when 5 then 8900
      when 6 then 2400
      when 7 then 6900
      else 16900
    end as unit_price_cents
  from generate_series(1, 30) as series
)
insert into public.order_items (
  id,
  order_id,
  product_id,
  quantity,
  unit_price_cents,
  opened
)
select
  ('60000000-0000-4000-8000-' || lpad(order_index::text, 12, '0'))::uuid,
  ('50000000-0000-4000-8000-' || lpad(order_index::text, 12, '0'))::uuid,
  ('30000000-0000-4000-8000-' || lpad(product_index::text, 12, '0'))::uuid,
  1,
  unit_price_cents,
  order_index in (19, 21, 24)
from prepared_items
on conflict (id) do update set
  product_id = excluded.product_id,
  unit_price_cents = excluded.unit_price_cents,
  opened = excluded.opened;

commit;

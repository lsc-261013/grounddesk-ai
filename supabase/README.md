# Supabase 数据层

`migrations` 包含 PostgreSQL、pgvector、索引、混合检索函数与 RLS；`seed` 只包含明确标记为 Demo 的虚构品牌、商品、政策和相对日期订单。

当前 Seed 的固定演示凭据之一：

- 订单号：`GD-2026D019`
- 邮箱：`demo.customer19@example.com`

订单日期和签收日期基于执行 Seed 当天计算，因此退货窗口案例不会随时间失效。登录用户会在 Auth 里程碑通过 Supabase Admin API 创建，避免直接依赖 `auth.users` 的内部表结构。

连接 Supabase 后执行：

```bash
supabase link --project-ref <project-ref>
supabase db push
psql "$DATABASE_URL" -f supabase/seed/001_demo_workspace.sql
```

不要把数据库密码或 Service Role Key 写入仓库。

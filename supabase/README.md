# Supabase 数据层

`migrations` 包含 PostgreSQL、pgvector、索引、混合检索函数与 RLS；`seed` 只包含明确标记为 Demo 的虚构品牌、商品、政策和相对日期订单。

当前 Seed 的固定演示凭据之一：

- 订单号：`GD-2026D019`
- 邮箱：`demo.customer19@example.com`

订单日期和签收日期基于执行 Seed 当天计算，因此退货窗口案例不会随时间失效。登录用户会在 Auth 里程碑通过 Supabase Admin API 创建，避免直接依赖 `auth.users` 的内部表结构。

在根目录 `.env` 填入 Supabase Dashboard 提供的直连或 Session Pooler URI，变量名为 `SUPABASE_DB_URL`。随后执行：

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

如果数据库密码包含 URI 保留字符，可在 Windows 项目终端运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\encode-db-password.ps1`。工具隐藏读取密码并仅把编码结果写入剪贴板。

这些命令只从服务端环境读取连接地址，不向前端暴露。迁移命令通过版本与 SHA-256 校验和防止重复执行和历史文件漂移；验收命令核对 Demo 数据、pgvector、索引、RLS 与关键业务案例。不要把数据库密码或 Supabase Secret Key 写入仓库。

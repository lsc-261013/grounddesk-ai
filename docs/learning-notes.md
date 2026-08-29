# GroundDesk 学习笔记

## 里程碑 1：工程骨架、Schema 与环境边界

### 解决什么问题

在实现 AI 功能前，先固定代码职责、Workspace 隔离、数据关系和供应商配置边界，避免后续把权限、检索和模型调用堆进一个服务。

### 数据从哪里来、到哪里去

Demo Seed 生成明确标记为模拟数据的 Avenlo 商品、政策和订单，写入 PostgreSQL 业务表。未来上传的文档会进入 `knowledge_documents`，切块进入 `knowledge_chunks`，向量与 `embedding_configs` 绑定。

### 关键文件

- `packages/shared/src`：跨端 Schema、常量和角色权限。
- `apps/api/src/config/env.ts`：环境变量与 connected 模式门禁。
- `supabase/migrations/202608290001_initial_schema.sql`：Schema、索引、函数和 RLS。
- `supabase/seed/001_demo_workspace.sql`：相对日期 Demo 数据。

### 为什么这样设计

先按 Workspace 建模，使每个 Repository 查询从第一天就必须考虑租户边界。Embedding 单独版本化，是因为即使维度相同，不同模型的向量空间也不能混合比较。订单时间相对 Seed 执行日生成，避免演示案例随时间失效。

### 一个真实问题及修复

最初的订单日期表达式把部分 `delivered_at` 算到了未来。修复方式是先计算下单日，再固定加四天得到签收日；近期案例保持在退货窗口内，历史案例稳定落在窗口外。生产构建检查还发现，按源码文件位置推导根目录 `.env` 会在打包后失效；现在改为同时解析进程工作目录与 Monorepo 根目录候选路径，并补充自动化测试。

### 如何手动验证

1. 运行 `pnpm env:check`，确认 offline 模式不需要密钥。
2. 运行 `pnpm db:validate`，确认迁移包含 pgvector、RLS、混合检索和 8/30 Demo 数据约束。
3. 连接 Supabase 后执行迁移与 Seed，并查询订单 `GD-2026D019`。

### 面试时 30 秒解释

“我先把 GroundDesk 建成 Workspace 隔离的 Monorepo。数据库用 Supabase PostgreSQL 和 pgvector，向量配置单独版本化，避免换模型后混用。检索基线是向量与全文召回后做 RRF，浏览器不接触 Supabase Secret Key 或模型密钥。”

### 深入追问

如果问为什么不能只在 SQL 上加 `workspace_id`：因为隔离需要 API 授权、Repository 查询条件与 RLS 三层共同成立。Supabase Secret Key 会绕过 RLS，所以服务端代码仍要通过 JWKS 验证用户 JWT、检查成员关系并显式过滤 Workspace。

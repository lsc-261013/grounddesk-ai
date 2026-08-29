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

首次连接 Supabase 执行迁移时，混合检索函数因为使用空 `search_path` 而无法解析 pgvector 的 `<=>` 运算符。事务自动回滚；修复时没有放宽函数搜索路径，而是把运算符显式写为 `operator(extensions.<=>)`，同时保留对 `search_path` 劫持的防护。

### 如何手动验证

1. 运行 `pnpm env:check`，确认 offline 模式不需要密钥。
2. 运行 `pnpm db:validate`，确认迁移包含 pgvector、RLS、混合检索和 8/30 Demo 数据约束。
3. 连接 Supabase 后执行迁移与 Seed，并查询订单 `GD-2026D019`。

### 面试时 30 秒解释

“我先把 GroundDesk 建成 Workspace 隔离的 Monorepo。数据库用 Supabase PostgreSQL 和 pgvector，向量配置单独版本化，避免换模型后混用。检索基线是向量与全文召回后做 RRF，浏览器不接触 Supabase Secret Key 或模型密钥。”

### 深入追问

如果问为什么不能只在 SQL 上加 `workspace_id`：因为隔离需要 API 授权、Repository 查询条件与 RLS 三层共同成立。Supabase Secret Key 会绕过 RLS，所以服务端代码仍要通过 JWKS 验证用户 JWT、检查成员关系并显式过滤 Workspace。

## 里程碑 2：Auth、角色与 Workspace 隔离

### 解决什么问题

让管理员和客服使用真实账号登录，同时确保前端不能伪造用户身份、角色或工作区。角色不是保存在浏览器里的可信字段，而是每次从服务端成员关系中得到。

### 数据从哪里来、到哪里去

密码由 Vue 提交给 Supabase Auth；浏览器得到短期 Access Token 后发送给 Fastify。API 调用 Supabase `getClaims` 验证 Token，再通过参数化 PostgreSQL 查询读取 `profiles` 和 `workspace_members`，最终返回最小化的会话资料与由服务端计算的权限。

### 关键文件

- `apps/web/src/stores/auth.ts`：浏览器会话同步和 API Session 加载。
- `apps/api/src/auth/supabase-auth-verifier.ts`：JWT Claims 验证适配器。
- `apps/api/src/auth/guards.ts`：Bearer Token、Workspace 与权限守卫。
- `apps/api/src/auth/postgres-identity-repository.ts`：参数化身份查询。
- `supabase/migrations/202608290002_auth_boundaries.sql`：Auth 用户资料触发器与最小授权。
- `apps/api/tests/auth.test.ts`：401、403、角色和跨 Workspace 确定性测试。

### 为什么这样设计

Supabase Auth 负责成熟的密码和 Token 生命周期，Fastify 负责业务授权。两者拆开后，即使浏览器把自己伪装成管理员，API 仍只承认数据库里的真实成员角色。Repository 采用依赖注入，因此 CI 可以使用可控身份 Provider，而真实 Smoke Test 再验证 Supabase 链路。

### 一个真实问题及修复

首次执行认证迁移时，触发器引用了尚不存在的 `profiles.locale`，事务完整回滚。修复是在同一份尚未落库的第二迁移里显式新增带双语约束的列，再重跑并验证第二次执行安全跳过。浏览器验收还发现 `name@example.com` 被 Vue I18n 当成链接语法，导致登录页渲染中断；改用 I18n 字面量转义并增加双语编译测试。

### 如何手动验证

1. 执行 `pnpm auth:bootstrap`，重复执行仍只有两名 Demo 成员。
2. 执行 `pnpm auth:smoke`，确认管理员设置权限为 200、客服为 403、跨 Workspace 均为 403。
3. 运行 `pnpm dev`，分别使用 README 中的管理员和客服账号登录。
4. 在浏览器开发者工具中确认前端不存在 Supabase Secret Key 或数据库连接串。

### 面试时 30 秒解释

“登录交给 Supabase Auth，但业务授权完全留在 Fastify。API 用 `getClaims` 验证 JWT，再从成员表读取真实角色，并对每个 Workspace 路由执行权限矩阵检查；RLS 是第二道隔离边界。这样浏览器篡改角色或 Workspace ID 都无法越权。”

### 深入追问

如果问为什么不只依赖 RLS：核心业务只通过 Node API，且服务端可能使用高权限数据库连接，所以 RLS 不能替代服务端授权。当前实现把 Token 校验、成员查询和权限判断拆成接口，既能单测所有拒绝路径，也能用真实 Supabase Smoke Test 验证签名与角色数据。

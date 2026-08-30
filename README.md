# GroundDesk

> 每一次回答，都有依据。Support answers you can verify.

GroundDesk 是一个面向电商、SaaS 与教育等场景的双语可信 AI 客服知识库 SaaS。项目正在按里程碑开发；公开 Demo、真实评测结果和截图会在完成部署与验收后补充，绝不使用占位指标冒充结果。

## 当前状态

里程碑 1 已完成：工程骨架、数据库 Schema、迁移、Demo Seed 与环境校验。迁移已在真实 Supabase 项目执行，重复运行会根据版本和 SHA-256 校验和安全跳过；Seed 重跑后仍保持 8 个商品和 30 个订单。

里程碑 2 已完成：Supabase Auth 真实密码登录、服务端 JWT Claims 校验、管理员/客服角色权限和 Workspace 双重隔离。管理员、客服与跨 Workspace 场景均已通过真实 Supabase Smoke Test；Demo 账号是明确标注、可重置的模拟账号。

里程碑 3 已完成：管理员可上传 PDF、Markdown 和 TXT，系统会执行私有存储、内容去重、页码/章节感知切块、真实 SiliconFlow BGE-M3 Embedding 与 Supabase pgvector + PostgreSQL 全文混合检索。当前真实 Demo 数据包含 4 份双语文档和 26 个 Chunk；三条核心检索 Smoke Case 均命中预期来源。该小样本结果不作为最终评测准确率。

里程碑 4 已完成：DeepSeek 单 Agent 会在四种受控意图中路由，服务端通过真实 SSE 发送处理阶段和回答 Token。知识回答经过相似度阈值、冲突与引用完整性校验；订单工具验证订单号与邮箱并返回脱敏只读结果；退货资格由版本化确定性规则计算。真实 Smoke Test 已通过知识引用、订单工具、退货规则和无答案人工接管四条链路。

里程碑 5 已完成：站内工单支持分配、回复与状态流转；Webhook 使用事务型 Outbox、HMAC、超时、重试和 SSRF 防护；26 条双语确定性评测覆盖知识、订单、退货、无答案、提示注入与跨 Workspace 隔离，最新真实运行 26/26 通过。

里程碑 6 的核心浏览器验收已完成：Playwright 覆盖双语持久化、reduced motion、390px 响应式、管理员保护页刷新、客服角色边界，以及真实订单 Tool Call 和无答案人工接管链路。

## 本地启动

```bash
pnpm install
Copy-Item .env.example .env
pnpm dev
```

离线模式不需要外部密钥，可启动 Web 与 API 骨架。真实 RAG、登录和公开 Demo 必须切换为 `RUNTIME_MODE=connected`，并在服务端配置 Supabase、DeepSeek 与 SiliconFlow 环境变量。

数据库迁移与 Demo Seed 使用根目录 `.env` 中仅服务端可见的 `SUPABASE_DB_URL`：

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

初始化并验证可重置的 Demo 成员：

```bash
pnpm auth:bootstrap
pnpm auth:smoke
```

初始化、重建并验证真实知识库：

```bash
pnpm knowledge:bootstrap
pnpm knowledge:reindex
pnpm knowledge:smoke
pnpm knowledge:http-smoke
pnpm agent:smoke
```

`knowledge:smoke` 会调用真实 Embedding 与混合检索；`knowledge:http-smoke` 还会验证登录、Workspace 权限、文档列表、切块预览、内容去重和客服写入拒绝。`agent:smoke` 会调用真实 DeepSeek、SiliconFlow 和 Supabase，产生少量 API 用量，并验证四条核心 Agent 路径。

## 测试与质量门禁

```bash
pnpm validate
pnpm test:e2e
```

`pnpm validate` 依次执行 TypeScript、ESLint、单元/集成测试和生产构建。默认 E2E 不依赖外部模型；需要验证真实公开 Demo 时，在本地设置 `E2E_LIVE_AI=true` 后单独运行 live public demo 用例，该用例会产生少量 DeepSeek 与 SiliconFlow 用量。

演示账号是公开测试资料，不用于真实业务：

- 管理员：`admin@demo.grounddesk.app`
- 客服：`agent@demo.grounddesk.app`
- 公共 Demo 密码：`GroundDesk!Demo2026`

## Monorepo

```text
apps/web             Vue 3 用户端、公开 Demo 与商家控制台
apps/api             Fastify API、RAG、Agent、工具与工单服务
packages/shared      跨端 Zod Schema、类型和常量
supabase/migrations  PostgreSQL、pgvector 与 RLS 迁移
supabase/seed        明确标记为模拟数据的 Demo Seed
evals                双语确定性评测集与运行器
docs                 架构、学习、部署与求职材料
scripts              本地验证和维护脚本
```

完整文档会随各里程碑同步维护。

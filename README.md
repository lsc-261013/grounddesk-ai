# GroundDesk

> 每一次回答，都有依据。Support answers you can verify.

GroundDesk 是一个面向电商、SaaS 与教育等场景的双语可信 AI 客服知识库 SaaS。项目正在按里程碑开发；公开 Demo、真实评测结果和截图会在完成部署与验收后补充，绝不使用占位指标冒充结果。

## 当前状态

里程碑 1 已完成：工程骨架、数据库 Schema、迁移、Demo Seed 与环境校验。迁移已在真实 Supabase 项目执行，重复运行会根据版本和 SHA-256 校验和安全跳过；Seed 重跑后仍保持 8 个商品和 30 个订单。

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

# GroundDesk 求职文案

以下文案只描述仓库中已经实现并验证的能力。在线 URL、GitHub URL 和评测结果来自真实部署；Lighthouse 只引用明确标注的本地 production 成绩，不预估线上分数。

## 简历项目描述

### GroundDesk｜双语可信 AI 客服知识库 SaaS

**技术栈：** Vue 3、TypeScript、Pinia、Vue I18n、Node.js、Fastify、Zod、Supabase Auth/PostgreSQL/Storage、pgvector、DeepSeek、SiliconFlow BGE-M3、Vitest、Playwright

- 从零设计并实现双语 AI Native 客服 SaaS，覆盖文档上传与异步处理、可点击引用问答、低置信度拒答、订单查询、确定性退货规则、人工工单和签名 Webhook 完整闭环。
- 构建 `向量检索 + PostgreSQL 全文检索 + RRF` 混合 RAG，保留页码、章节、语言和商品型号元数据；通过 Embedding 配置版本隔离避免新旧向量混用，并在生成后执行引用完整性校验。
- 使用单 Agent 显式状态机约束 4 种意图，DeepSeek 仅负责意图/工具选择与结果解释；工具经过 allowlist、Zod Schema、超时和审计，退货资格由版本化纯函数确定，禁止模型直接退款或执行 SQL。
- 通过 Supabase JWT Claims、Fastify Workspace 授权、参数化 Repository 与 RLS 实现管理员/客服权限及多租户隔离；订单必须匹配订单号和邮箱，并仅返回脱敏字段。
- 建立 26 条双语确定性评测集和真实 Provider 运行链路，当前真实基线为 26/26；引用覆盖率、Retrieval@5、工具选择、拒答和隔离指标来自数据库运行记录，并保留从 21/26 到 26/26 的失败分析。
- 使用 Vitest、Fastify Inject 与 Playwright 覆盖核心规则、RAG/工具/工单集成、角色边界、双语、reduced motion、移动端和真实公开 Demo 路径；TypeScript strict、lint、测试与生产构建纳入统一质量门禁。

## Boss 直聘开场

您好，我主要做 Vue 3 + TypeScript + Node.js 的 AI 应用全栈开发。最近独立完成了 GroundDesk：一个带真实混合 RAG、引用校验、DeepSeek Tool Calling、确定性退货规则、人工接管和多租户权限的双语 AI 客服 SaaS。项目不是静态 UI 或写死回答，包含真实部署链路、26 条可复现评测和完整测试。我希望应聘 AI 应用全栈 / AI Native 产品工程方向，可以发您在线 Demo、GitHub 和 3 分钟演示。

## 邮件短介绍

**主题：** AI 应用全栈工程师｜GroundDesk 可信 AI 客服项目

您好，

我是一名以 Vue 3、TypeScript 和 Node.js 为主栈的 2026 届开发者。我独立设计并实现了 GroundDesk，一套双语可信 AI 客服 SaaS：文档经真实 Embedding 与 pgvector/全文混合检索进入知识库；回答必须带可展开引用；无可靠证据时拒答并创建人工工单；订单和退货通过服务端白名单工具与确定性规则处理。

项目同时实现 Supabase Auth/RLS、多租户权限、SSE 流式轨迹、Webhook Outbox、真实评测与 Playwright 验收。我可以在三分钟内现场演示从 RAG 引用、Tool Calling 到人工接管的完整链路，并解释其中的失败案例与工程取舍。

- 在线 Demo：https://grounddesk-ai-lsc.onrender.com
- GitHub：https://github.com/lsc-261013/grounddesk-ai

感谢阅读，期待进一步交流。

## Fiverr / Upwork 作品集一句话

Built a bilingual, evidence-grounded AI support SaaS with hybrid RAG, verifiable citations, safe order tools, deterministic return rules, human handoff, and multi-tenant security.

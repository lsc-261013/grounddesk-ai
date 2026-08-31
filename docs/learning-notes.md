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

## 里程碑 3：文档摄取、Embedding 与混合检索

### 解决什么问题

把商家的 PDF、Markdown 和 TXT 变成可追溯证据，而不是把整份文档直接塞给模型。链路必须能发现重复上传、保留页码与章节，并确保每次检索只能看到当前 Workspace 的当前向量版本。

### 数据从哪里来、到哪里去

管理员通过 Fastify Multipart API 上传文档。服务端校验内容并计算 SHA-256，把原文件写入 Supabase 私有 Storage，把解析出的结构化 Chunk 批量发送给 SiliconFlow BGE-M3，最终将 1,024 维向量和元数据写入 PostgreSQL。用户查询同样生成向量，与全文召回结果通过 RRF 融合后返回证据候选。

### 关键文件

- `apps/api/src/knowledge/document-parser.ts`：文件安全校验与 PDF/文本解析。
- `apps/api/src/knowledge/chunker.ts`：章节感知切块、重叠和 Chunk 去重。
- `apps/api/src/knowledge/embedding-provider.ts`：SiliconFlow 适配器、维度校验、超时与重试。
- `apps/api/src/knowledge/postgres-knowledge-repository.ts`：状态持久化、向量写入和 Workspace 范围混合检索。
- `apps/api/src/knowledge/service.ts`：上传、去重、异步处理与失败重试编排。
- `apps/web/src/views/KnowledgeView.vue`：上传、状态、错误、权限和切块预览。

### 为什么这样设计

原文件和检索 Chunk 分开保存，既能保留审计来源，也能独立重建索引。文档 Hash 在上传前比较，重复内容不会产生第二份向量费用。Embedding 配置独立版本化，避免换模型后比较不在同一空间的向量。混合检索用可解释的 RRF，而不是把向量距离包装成虚假的准确率。

### 一个真实问题及修复

第一次真实索引后，相似的 `Airwave S1` 与 `Airwave S1 Pro` 章节因为 Chunk 重叠被拼到一起，虽然召回成功，却会给后续生成制造误答风险。修复为：标题边界强制刷新 Chunk，且跨章节不继承重叠。重建索引后，4 份文档由 12 个过粗 Chunk 变为 26 个边界清晰的 Chunk，三个真实检索案例仍全部命中预期来源。

### 如何手动验证

1. 运行 `pnpm knowledge:bootstrap`，再次运行应全部返回 `duplicate: true`。
2. 运行 `pnpm knowledge:smoke`，检查相似型号、保修与航空限制的前 5 条来源。
3. 管理员登录 `/console/knowledge`，上传新文档并观察 `queued/processing/ready`。
4. 展开文档切块，检查章节、页码、商品型号和原文。
5. 用客服账号上传，API 必须返回 403。

### 面试时 30 秒解释

“上传后我先做内容 Hash 去重，再保留 PDF 页码或 Markdown 标题进行结构化切块。Chunk 用 BGE-M3 生成 1,024 维向量，检索时与 PostgreSQL 全文召回做 RRF 融合。所有索引都绑定 Workspace 和 Embedding 版本，真实 Smoke Test 验证了双语、相似型号和政策问题。”

### 深入追问

如果问为什么不用纯向量：型号、订单字段和术语经常更适合精确关键词召回，而中英文语义问题适合向量召回；RRF 不要求两类分数处在同一尺度。如果问如何换 Embedding 模型：创建新的 `embedding_configs` 版本，重建 Chunk 向量后再切换 active，查询永远指定配置 ID，不混搜旧向量。

## 里程碑 4：流式回答、引用门禁与 Agent 工具

### 解决什么问题

让 AI 不只是“能回答”，而是只能在证据和受控工具边界内回答。用户需要看到真实处理阶段、逐步到达的回答、可展开引用，以及资料不足时可解释的拒答和人工接管。

### 数据从哪里来、到哪里去

用户问题经公共 SSE API 写入会话。DeepSeek 选择四种意图之一；知识问题进入真实混合检索，订单或退货问题进入白名单工具。可见 Token、引用和工具摘要流向 Vue Playground，最终回答、候选证据、工具审计、用量和工单写入 Supabase。

### 关键文件

- `apps/api/src/generation/deepseek-provider.ts`：DeepSeek 规划、Tool Calling 与 SSE 解析。
- `apps/api/src/agent/service.ts`：单 Agent 状态机和所有失败分支。
- `apps/api/src/rag/evidence-guard.ts`：相似度、冲突、注入与引用完整性门禁。
- `apps/api/src/tools/service.ts`：双凭据订单查询与最小化返回。
- `apps/api/src/tools/return-policy.ts`：不依赖 LLM 的退货资格纯函数。
- `apps/web/src/stores/chat.ts`：消费真实 SSE 事件，不伪造延迟。
- `apps/web/src/views/PlaygroundView.vue`：阶段、工具和引用的可观察界面。

### 为什么这样设计

模型擅长理解意图和解释结果，但不适合决定退款资格或数据库权限。因此模型只选择 allowlist 工具，服务端验证参数并执行固定查询；退货结果来自可单测的政策函数。回答先受证据阈值约束，再受引用完整性约束，避免“检索到了但生成仍乱说”。

### 一个真实问题及修复

第一次真实知识回答包含 2 个正确引用，却被“每个句子都必须带引用”的门禁误判，因为模型会在同一段落末尾统一标注来源。修复为只对包含数字、支持性、兼容性、保修或退货等事实信号的段落要求合法引用，介绍性句子不误伤。随后真实知识链路通过。

第二个真实问题中，DeepSeek 识别出 `order_lookup`，但规划请求同时设置 JSON Output 与 Tool Calling 时没有发出函数调用。移除模式叠加、按官方 Tool Calling 格式使用 `tool_choice: auto` 后，订单与退货工具都真实调用成功。服务端参数校验没有因此放松。

### 如何手动验证

1. 运行 `pnpm agent:smoke`，确认四条真实链路全部通过。
2. 登录 `/console/playground`，观察阶段必须来自 SSE，而非固定时间动画。
3. 提问相似型号问题并展开 `[n]` 查看真实 Chunk。
4. 使用 README 的订单号与邮箱，确认只返回脱敏只读信息。
5. 提出无答案问题，确认回答拒绝且会话变为人工接管。

### 面试时 30 秒解释

“我用了一个显式状态机，而不是多 Agent。DeepSeek 只做意图选择、白名单 Tool Calling 和结果解释；服务端用 Zod 校验参数。知识回答必须通过向量阈值、冲突和引用完整性三道门，退货资格则完全由版本化规则函数判断。前端看到的是服务端真实 SSE 事件，不展示思维链。”

### 深入追问

如果问流式回答结束后才发现引用不合格怎么办：客户端支持 `replace_answer` 纠正事件，服务端不保存不合格答案为可靠结果，并立即创建工单。若问为什么不先完整生成再展示：那会失去真实首 Token 体验；当前设计在体验和最终一致性之间用流式展示加终态校验折中，同时保留完整审计。

## 里程碑 5：工单、Webhook、可观测性与评测

### 解决什么问题

可信客服不能在“AI 回了一句话”时结束。本模块把拒答转成人工可处理的工单，把外部通知变成签名且可重试的 Webhook，并用确定性评测证明检索、工具与隔离边界确实工作。

### 数据流

拒答或人工请求从 `AgentService` 进入 `tickets`，保存会话摘要、证据 Chunk 与工具调用 ID；数据库触发器在同一事务中生成 Webhook Outbox 记录，后台投递器执行 URL 安全检查、HMAC 签名、超时和有限重试。评测运行读取 `eval_cases`，通过真实或 Mock 执行器逐条执行，并把实际结果与确定性期望写入 `eval_results`。

### 关键文件

- `apps/api/src/tickets/`：角色约束、分配、回复和状态流转；
- `apps/api/src/webhooks/`：密钥加密、SSRF 防护、签名与 Outbox 投递；
- `apps/api/src/evaluations/`：执行器、评分、持久化和报告；
- `apps/api/src/analytics/`：过滤评测流量后的真实运营指标；
- `supabase/migrations/202608300005_ticket_webhook_outbox.sql`：事务型 Outbox；
- `supabase/migrations/202608300006_conversation_sources.sql`：运营/评测流量边界；
- `supabase/seed/002_evaluation_cases.sql`：26 条双语确定性用例。

### 为什么这样设计

工单和 Webhook 使用数据库事务型 Outbox，避免“工单已创建但进程刚好崩溃导致通知永远丢失”。签名密钥只在创建时返回一次，数据库保存 AES-GCM 密文；目标 URL 在保存和每次投递时都重新解析，防止 DNS Rebinding。评测会话标记为 `evaluation`，既保留消息与用量审计，又不污染运营看板、公开额度和客服队列。

### 一个真实问题与修复

真实评测最初只有 21/26。原因不是单一“模型不聪明”，而是规划 JSON 格式、相似度阈值、意图约束和引用格式分别存在边界。逐条查看失败的 `actual` 与消息 `error_type` 后，分别增加 JSON 提取后的 Schema 校验、真实分布阈值、原文参数绑定和一次引用修复重试，最终达到 26/26。过程中没有降低拒答规则。

### 如何手动验证

1. 以管理员运行 `pnpm eval:live`，再执行 `pnpm eval:report`；
2. 在控制台 Evaluations 展开最新运行，确认 26 条逐项结果来自数据库；
3. 提出知识库不存在的问题，在 Tickets 查看摘要、证据与接管原因；
4. 创建 Webhook 后只保存一次签名密钥，向公开测试端点发送测试事件并核对 `X-GroundDesk-Signature`；
5. 以客服账号登录，确认只能看到分配给自己的工单且无法打开设置写接口。

### 面试时 30 秒解释

“GroundDesk 把低置信度结果转成带证据与工具轨迹的人工工单。外部通知走事务型 Outbox，用 HMAC 签名、超时、重试和 SSRF 防护。质量不是页面写死的数字，而是 26 条双语确定性评测，真实 Provider 最新 26/26；评测流量与运营指标严格分开。”

### 继续追问时怎样深入

可以展开说明 Outbox 的原子性、客服角色的行级可见范围、签名密钥轮换影响、DNS Rebinding 防护、为什么 LLM Judge 不能作为唯一真值，以及如何从失败用例定位到检索、路由、工具或引用校验的具体层级。

## 里程碑 6：真实浏览器验收与响应式边界

### 解决什么问题

单元测试无法证明用户真的能在浏览器完成登录、刷新保护页、切换语言、使用手机布局或触发真实 Agent。该模块用 Playwright 固化匿名顾客、管理员和客服三种身份的关键旅程，并把真实 AI 链路设为显式 Smoke Test，避免普通 CI 因供应商波动而不稳定。

### 数据流与关键文件

`apps/web/e2e/grounddesk.spec.ts` 通过真实 Chromium 操作 Vue 页面，登录请求经过 Supabase Auth 与 Fastify，业务数据来自真实 Demo Workspace。`apps/web/playwright.config.ts` 管理前后端测试服务、失败截图、Trace 和录像；`apps/web/src/i18n.ts` 负责 Locale 初始化与文档语言同步。

### 为什么这样设计

确定性浏览器用例默认验证双语、reduced motion、390px 横向溢出、会话刷新和角色边界。会消耗外部额度的订单 Tool Call 与无答案接管通过 `E2E_LIVE_AI=true` 单独执行。这样既让 CI 稳定，也保留公开 Demo 使用真实 Provider 的证据。

### 一个真实问题及修复

首轮 E2E 发现语言按钮能立即切成英文，刷新后内容仍为英文，但 `<html lang>` 回到了静态模板的 `zh-CN`。原因是 i18n 读取了持久化 Locale，却没有在应用初始化时同步文档语言。修复为只读取一次 `initialLocale`，同时赋给 Vue I18n 和 `document.documentElement.lang`。测试接入后还发现 Vitest 会误收集 `e2e` 目录，因此将单元测试显式限定为 `tests`，避免两个测试运行器互相执行。

扩展到“管理员分派 → 客服回复”后，Fastify Inject 的工单测试仍全部通过，但真实 Chromium 在 PATCH 预检阶段被 CORS 拒绝。根因是 API 使用了插件默认方法清单，没有显式包含 PATCH/DELETE。修复为按实际路由声明 `GET/HEAD/POST/PATCH/DELETE/OPTIONS`，增加 OPTIONS 回归测试，并由真实浏览器再次完成分派、回复和解决闭环。Trace 同时发现 `low_confidence` 接管原因漏翻译，已补齐中英文与单测。

一键 Demo Reset 的真实浏览器验收又发现两层只在完整路径出现的问题：前端先对无 Body 的 POST 错误声明 JSON，修复为仅在确有非 FormData Body 时设置 `Content-Type`；请求进入数据库后，`tickets.conversation_id` 的 `ON DELETE RESTRICT` 阻止先删会话。Reset 事务因此改为先删除工单（回复级联），再删除会话。每次失败都由事务完整回滚，没有留下半重置数据。

视觉证据录制的首版截图虽然没有布局溢出，却把异步商品、评测和运营指标拍在 loading 阶段。修复不是添加固定等待时间，而是等待 4 件精选商品、8 件 Demo 商品、Live Evaluation 卡片和控制台骨架消失等真实 DOM 条件。最终脚本覆盖 1440×900、1280×800、768×1024 与 390×844。首轮 Lighthouse 又定位到小字号标签对比度、缺失 favicon/robots，以及审计 Origin 与 CORS 不一致三类真实问题；修复后本地 production 桌面四项为 99/100/100/100，移动端为 97/100/100/100。

最终反证审计发现，上传大小/工作区文档数量/失败重试和订单工具的两次数据库重试、脱敏、错误分流虽然已经实现，但原有测试只通过更宽的服务链路间接覆盖。新增独立单元测试后，API 测试由 73 条增加到 81 条；这避免了“代码存在”等同于“边界已被证明”的验收误区。

### 如何手动验证

1. 运行 `pnpm test:e2e`，确认三条确定性浏览器用例通过；
2. 设置 `E2E_LIVE_AI=true` 后运行 Live Demo 用例，观察订单工具和人工工单；
3. 在 390×844 下打开 `/demo`，确认 `scrollWidth` 不超过视口；
4. 用客服账号直接访问 `/console/settings`，必须显示无权限状态；
5. 切换英文并刷新，内容与 `<html lang>` 都必须保持 `en-US`；
6. 设置 `E2E_VISUAL_AUDIT=true` 运行视觉验收，确认四个目标尺寸通过且截图在真实数据就绪后生成。

### 面试时 30 秒解释

“我没有把 E2E 等同于页面能打开。Playwright 覆盖三种身份、保护页刷新、角色导航、双语持久化、reduced motion 和手机无溢出；真实 AI 用例还会验证订单 Tool Call、低置信度拒答以及工单确实写入后台。外部 Provider 用例显式开启，普通 CI 保持确定性。”

### 继续追问时怎样深入

可以解释为什么 UI 断言关注用户可见的脱敏摘要而不是原始 Tool JSON、为什么真实 Provider 测试不应成为每次提交的硬依赖、如何用 Trace 定位刷新竞态，以及浏览器测试怎样补足 RLS、API 集成测试和纯函数单测之间的空白。

安全矩阵复查时发现短时限流只有 Fastify 默认 IP 维度，Session 仅用于会话归属而没有独立速率窗口。现在保留 IP 限流，同时在请求体完成 Schema 解析后增加浏览器 Session 窗口；测试分别证明重复 Session 会被限制、轮换 Session 也不能绕过 IP 限制。Workspace 每日请求与 Token 总额度仍是最终成本上限。

## 里程碑 6 补充：商品主数据与可恢复 Demo

### 解决什么问题

管理员需要管理真实业务中的商品主数据，而不是只能查看一套写死的商城卡片。商品又被历史订单引用，因此管理动作必须支持创建、编辑和归档，不能用物理删除破坏订单审计。

### 数据流与关键文件

管理员在 `ProductsView.vue` 编辑双语名称、描述、规格、价格和退货属性；`products.ts` 通过带 JWT 的 API 调用 `routes/catalog.ts`。服务端用共享 Zod Schema 校验，再由 `postgres-catalog-repository.ts` 写入 Workspace 范围内的 `products`。`demo-products.ts` 保存可审计的 Demo 基线，重置时恢复 8 件商品并清理无订单引用的临时商品。

### 为什么这样设计

`is_active` 把公开展示状态和数据存续分开：归档商品从 Demo 商城隐藏，但历史订单仍能关联原 SKU。商品读写是管理员权限，客服直接访问页面时得到明确无权限状态。SKU 和型号都由数据库 Workspace 唯一约束兜底，不仅依赖前端检查。

### 一个真实问题及修复

完成商品页后，真实浏览器检查发现旧客服会话点退出仍被路由守卫送回控制台。原因是供应商登出异常时本地 Pinia 会话没有清理。修复为使用 Supabase local scope，并在 `finally` 中清除当前浏览器会话；单测覆盖供应商返回错误的分支，Playwright 再验证退出后确实回到登录页。

### 如何手动验证

1. 管理员打开 `/console/products`，确认显示 8 件真实数据库商品；
2. 编辑价格或归档商品，公开 `/demo` 应同步变化；
3. 客服账号的导航不出现商品页，直接访问时显示管理员权限提示；
4. 执行 Demo Reset 后，8 件基准商品和公开状态应恢复；
5. 在 390×844 下检查卡片、弹窗和表单，不应出现横向滚动。

### 面试时 30 秒解释

“商品不是前端常量，而是 Workspace 隔离的主数据。管理员可以维护双语内容、JSON 规格和退货属性；历史订单要求我采用归档而非删除。公开 Demo 的访客可能修改数据，所以一键重置会恢复版本化的 8 件基线商品，保证演示可重复。”

### 继续追问时怎样深入

可以说明数据库唯一约束如何处理并发写入、为什么规格使用受限 JSON 对象而不是动态表列、归档对检索索引的影响，以及公开 Demo 应如何配合定时重置和请求额度防止滥用。

## 里程碑 7：部署边界与平台端口

### 解决什么问题

本地能运行不等于托管环境能启动。Vercel 需要正确的 Monorepo 构建目录和 SPA Rewrite，Render 要求监听 `0.0.0.0` 与平台分配的 `PORT`，两端还要用精确 Origin 完成 CORS，且不能把服务端密钥打进 Vite 产物。

### 数据流与关键文件

`vercel.json` 保留为可迁移部署方案；`render.yaml` 同时构建 `@grounddesk/web` Static Site 与开发期 `@grounddesk/api` Free Web Service。前端发布 `apps/web/dist` 并设置 SPA Rewrite。由于 Free 实例不支持 Pre-deploy Command，API 的幂等迁移暂时在 Build Command 中执行，再用 `/health` 验证实例；升级常驻实例后恢复为独立 Pre-deploy。`apps/api/src/config/env.ts` 优先读取本地 `API_PORT`，部署时回退到 Render 提供的 `PORT`。

### 为什么这样设计

部署配置版本化能让面试官和后续维护者复现环境，而不是依赖 Dashboard 中无人知道的手工设置。Blueprint 对密钥只声明 `sync: false`，公开 `VITE_` 变量与服务端 Secret 明确分开。Seed 不进入每次部署，避免上线更新意外重置 Demo 数据。

### 一个真实问题及修复

部署审计先发现 API 只读取 `API_PORT=8787`，而 Render 推荐运行时绑定自动提供的 `PORT`；随后 Render 的真实 Blueprint 校验又指出 Free 计划不支持 Pre-deploy Command 与 `maxShutdownDelaySeconds`。端口修复为 `API_PORT ?? PORT` 并增加环境解析测试；迁移暂时移到开发期 Build Command；关闭延迟字段从 Free 配置删除，并在部署文档中记录付费升级后的恢复路径。

### 如何手动验证

1. 不设置 `API_PORT`、仅设置 `PORT=10000`，确认 API 监听 10000；
2. 同时设置两者，确认 `API_PORT` 优先；
3. 用生产构建启动 API，访问 `/health`；
4. 在 Render Static Site 刷新 `/console/products`，确认 SPA Rewrite 不返回 404；
5. 检查浏览器构建产物中只有 Project URL 与 Publishable Key，没有 Secret Key 或数据库 URI。

### 面试时 30 秒解释

“我把部署当作代码的一部分：Render Static Site 配置 Monorepo Web 构建和 SPA 路由，开发期 Free Web Service 配置幂等迁移、健康检查与平台端口回退。浏览器只得到 Publishable Key，所有高权限密钥留在 API。上线求职 Demo 前会升级常驻实例，并从无痕窗口重新跑 RAG、工具和接管。”

部署前的最后一轮验收审计发现，Playwright 配置把 Base URL 和两个 Dev Server 固定在本地，无法把已经验证的浏览器路径原样迁移到公开站点。配置现支持 `E2E_BASE_URL`：设置时不启动本地服务，直接验证远程 Origin；不设置时保持原有本地行为。这让线上验收与本地验收使用同一份测试，而不是部署后靠另一套临时步骤产生证据漂移。

真实 Render 首次部署又暴露了一个只会在托管镜像出现的问题：Build Command 里的 `corepack enable` 会尝试重建 `/usr/bin/pnpm`，但该路径在 Render Node 26 镜像中只读，API 和 Static Site 都以 `EROFS` 立即失败。仓库已声明 `packageManager: pnpm@11.19.0`，平台也已经提供 pnpm shim，因此修复是删除多余的 `corepack enable`，提交 Blueprint 后手动同步并审批。修复后的两个服务均为 Live，公网 `/health` 显示 connected；远程 Playwright 随后通过登录、角色隔离、真实引用、订单 Tool Call、无答案接管、客服结单和四档响应式检查。这一经历说明部署配置必须由真实平台日志验证，不能只靠本地构建推断。

公网 Lighthouse 13 首次实测达到桌面 98/100/100/100、移动 94/100/100/100，但移动 CLS 为 0.103。报告只把页脚列为位移元素，第一反应是给异步商品区预留高度；占位卡片虽然改善了加载和错误状态，CLS 却完全不变。继续检查渲染时序后发现真正原因是路由守卫等待 Supabase Session 时 `RouterView` 暂空，页脚先进入首屏，路由内容随后把它推走。将页脚与认证初始化状态绑定后，本地 production 复测为 Performance 98、CLS 0、零位移节点。修复部署后的最终公网复测进一步达到桌面 99/100/100/100、移动 98/100/100/100，移动 CLS 为 0。这是一次“先用指标定位、再用对照实验否定错误假设”的真实性能修复，而不是为了分数盲目压缩资源。

### 继续追问时怎样深入

可以说明为什么免费实例只能暂时把幂等迁移放进 Build Command、升级后为什么恢复 Pre-deploy、Seed 为什么不能进入部署链路、CORS Origin 为什么不能写通配符、静态前端与 API 如何分别回滚，以及常驻实例如何避免 HR 首次访问冷启动。

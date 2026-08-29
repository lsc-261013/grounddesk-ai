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

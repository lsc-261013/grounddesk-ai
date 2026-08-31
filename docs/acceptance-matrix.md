# GroundDesk 验收矩阵

本文件把原始项目标准映射到可复查证据。状态分为“本地已验证”和“待线上验证”；没有公开 URL 的项目不能据此宣称最终完成。

## 功能与安全

| 验收域                                              | 当前状态   | 权威证据                                                                          |
| --------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| 注册、登录、JWT、管理员/客服权限                    | 本地已验证 | `202608290002_auth_boundaries.sql`、`auth.test.ts`、`auth:smoke`、登录/保护页 E2E |
| Workspace 隔离与 RLS                                | 本地已验证 | 26/26 张业务表启用 RLS；`auth:smoke` 跨 Workspace 为 403；评测隔离用例 2/2        |
| 8 件商品与 30 个动态日期订单                        | 本地已验证 | 幂等 Seed、`db:verify`、商品与订单控制台、Demo Reset E2E                          |
| PDF/Markdown/TXT 上传、去重、状态、重试、Chunk 预览 | 本地已验证 | Knowledge Service、解析/切块测试、`knowledge:http-smoke`、知识库浏览器 E2E        |
| 真实 Embedding 与混合检索                           | 本地已验证 | SiliconFlow `BAAI/bge-m3`、`vector(1024)`、全文检索函数、`knowledge:smoke` 3/3    |
| DeepSeek 流式回答与真实引用                         | 本地已验证 | Provider Adapter、SSE 路由、引用完整性校验、`agent:smoke`、Live Demo E2E          |
| 低置信度/冲突/注入拒答与人工接管                    | 本地已验证 | Evidence Guard、Agent 单测、评测无答案与注入用例、Live Demo E2E                   |
| 订单查询白名单工具                                  | 本地已验证 | DeepSeek Function Calling、Zod 参数、邮箱匹配、脱敏结果、Agent Smoke              |
| 确定性退货资格与人工审批                            | 本地已验证 | 版本化规则、退货单测 100%、5 条 Live Evaluation、无自动退款路径                   |
| 工单分配、回复、状态流转                            | 本地已验证 | Ticket Service、真实数据库 Smoke、管理员转客服 E2E                                |
| Webhook Outbox、HMAC、超时、重试、SSRF 防护         | 本地已验证 | 数据库触发器、Webhook 安全测试、真实本地 HTTP 503 → 202 重试测试                  |
| IP、Session、每日请求与 Token 成本边界              | 本地已验证 | Fastify IP 限流、独立 Session 窗口、Workspace 每日数据库额度、73 个 API 测试      |
| Demo 一键恢复                                       | 本地已验证 | 事务重置、8 商品/30 订单/空工单浏览器验收；知识与成员保留                         |
| 密钥与前端边界                                      | 本地已验证 | `.env` 被忽略；Git 历史 Secret 模式 0；Web 产物服务端 Secret 模式 0               |

## 产品、视觉与质量

| 验收域                             | 当前状态   | 权威证据                                                                                 |
| ---------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| 双语落地页、公开 Demo、核心控制台  | 本地已验证 | Vue I18n 持久化、语言单测、浏览器刷新 E2E                                                |
| Hero 可信流程动画                  | 本地已验证 | `TrustFlowAnimation.vue`；视口触发、悬停暂停、离屏暂停、Reduced Motion E2E               |
| 服务端事件驱动聊天轨迹             | 本地已验证 | SSE Stage/Token/Citation/Tool 事件；无写死等待；Live Demo E2E                            |
| 1440、1280、768、390 响应式        | 本地已验证 | `visual-audit.spec.ts` 四视口无水平溢出；三张真实数据截图                                |
| 键盘、焦点、Reduced Motion、对比度 | 本地已验证 | 可见 Focus 样式、语义控件、Reduced Motion 测试、Lighthouse Accessibility 100             |
| 本地 production Lighthouse         | 本地已验证 | 桌面 99/100/100/100；移动 97/100/100/100（Performance/Accessibility/Best Practices/SEO） |
| TypeScript、lint、测试、构建       | 本地已验证 | TypeScript strict；lint 零告警；Shared 3 + API 73 + Web 10；production build 通过        |
| 真实确定性评测                     | 本地已验证 | Live Run `b2310ecb-6383-4259-9c3b-96bd3f1281c4`，26/26，无失败                           |

## 文档与所有者交付

README、架构、RAG、Agent、评测、部署、演示脚本、面试问答、简历文案、Owner Checklist、英文自由职业服务包与持续学习笔记均已存在，并只描述真实实现。

## 外部部署状态

截至 2026-08-31，公共 GitHub 仓库已创建并推送，项目所有者已授权 Render Static Site 作为前端托管；作者、联系地址与仓库 URL 已写入版本化部署配置。Render 已真实读取并校验 Blueprint，期间发现并修复了 Free Web Service 不支持 `maxShutdownDelaySeconds` 的平台差异。

以下项目未完成前不得宣布最终上线：

1. 经项目所有者明确确认后，将本地服务端 Secret 安全写入 Render，并创建 Free API 与 Static Site；
2. 将最终 Web Origin 写入 Supabase Auth URL；API CORS Origin 已由 Blueprint 服务引用自动生成；
3. 在无痕窗口重跑登录、引用问答、订单工具、拒答接管与客服结单；
4. 对公开 URL 重跑四视口、Lighthouse、Secret 模式与响应头检查；
5. 把最终 URL 写入 README、简历文案和演示脚本；
6. 投递简历前经项目所有者确认升级 API 为常驻实例，避免 Free 实例休眠造成首次访问冷启动。

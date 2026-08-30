# 项目所有者复现清单

这不是“确认 AI 帮我跑过”的清单。每项都需要项目所有者亲手完成，并保存命令输出、截图或口头解释作为证据。投递简历前十项必须全部勾选。

## 1. 从干净 Clone 启动

- [ ] 在新的目录 Clone 仓库；
- [ ] 执行 `corepack enable` 和 `pnpm install --frozen-lockfile`；
- [ ] 从 `.env.example` 创建 `.env`，不复制旧工作区的构建产物；
- [ ] 执行 `pnpm dev`，打开落地页、Demo 和 `/health`；
- [ ] 能解释 `apps/web`、`apps/api`、`packages/shared`、`supabase`、`evals` 和 `docs` 的职责。

**留存证据：** 干净 Clone 路径、安装输出、首页与健康检查截图。

## 2. 独立配置开发环境

- [ ] 从供应商后台独立找到 Project URL、Publishable Key、Secret Key 和 PostgreSQL URI；
- [ ] 正确区分 `VITE_SUPABASE_*` 公开变量与服务端 Secret；
- [ ] 对数据库密码中的 URL 保留字符进行百分号编码；
- [ ] 执行 `pnpm env:check`，解释 `offline` 与 `connected`；
- [ ] 执行 `pnpm db:verify`，说明 pgvector、RLS、Storage 和迁移校验结果。

**留存证据：** 只保存变量名和布尔校验，不截图或复制密钥值。

## 3. 上传新文档并观察切块

- [ ] 以管理员登录 `/console/knowledge`；
- [ ] 上传一份不含敏感信息的新 Markdown、TXT 或 PDF；
- [ ] 观察 `queued → processing → ready`；
- [ ] 展开 Chunk，指出章节或页码、语言、来源与更新时间；
- [ ] 再次上传相同文件，确认不会增加重复文档或 Chunk；
- [ ] 上传空文件或错误类型，确认界面给出可理解错误。

**留存证据：** 文档状态、Chunk 预览和重复上传结果。

## 4. 在数据库定位向量和元数据

- [ ] 在 Supabase SQL Editor 找到刚上传的 `knowledge_documents`；
- [ ] 关联 `knowledge_chunks` 与 `embedding_configs`；
- [ ] 指出 `page_start/page_end`、`section_path`、`language`、`product_models` 和内容 Hash；
- [ ] 确认向量维度是 1024，且 Chunk 使用当前激活的 Embedding 配置；
- [ ] 能解释为什么更换模型要新建版本并重建，而不是混写旧向量。

**留存证据：** 隐去正文敏感内容后的查询截图与口头解释。

## 5. 运行真实问答并定位引用

- [ ] 在 Playground 提问 `LinkCore C240 线材的保修期是多久？`；
- [ ] 观察 SSE 的理解、检索、校验和生成阶段；
- [ ] 展开每条引用，核对文档、章节/页码和原文；
- [ ] 在数据库找到该会话的检索候选、最终引用、Token 和延迟；
- [ ] 能说明 RRF 排名与拒答相似度阈值不是同一个数。

**留存证据：** 完整回答、引用原文和对应审计记录。

## 6. 手动触发订单 Tool Call

- [ ] 使用 `GD-2026D019` 与 `demo.customer19@example.com`；
- [ ] 确认界面显示 `order_lookup` 结构化步骤与脱敏结果；
- [ ] 把邮箱改成 `wrong@example.com`，确认不返回订单详情；
- [ ] 输入不存在订单，区分 `not_found` 与 `email_mismatch`；
- [ ] 能指出 Zod Schema、allowlist 和参数化 Repository 的关键文件。

**留存证据：** 成功、邮箱不匹配和不存在三种结果。

## 7. 修改退货政策并观察结果

- [ ] 先运行一个已知退货用例并记录结果；
- [ ] 在测试环境新增政策版本或调整对应窗口，不覆盖历史版本；
- [ ] 再次运行同一业务条件，观察确定性结果变化；
- [ ] 运行退货规则单测，确认其他分支没有回归；
- [ ] 恢复 Demo 基线，并说明为什么 eligible 仍要求人工审批。

**留存证据：** 修改前后规则版本、原因码、匹配条款与测试输出。

## 8. 制造无答案问题并验证人工接管

- [ ] 提问 `你们是否为火星殖民地提供维修服务？`；
- [ ] 确认系统说明资料不足，而不是自由编造；
- [ ] 在管理员 Tickets 找到刚生成的工单；
- [ ] 检查 AI 摘要、接管原因、已检索证据和工具轨迹；
- [ ] 分配给客服，以客服账号回复并修改状态；
- [ ] 管理员确认工单处理时间和回复可见。

**留存证据：** 顾客端拒答、后台工单和客服回复闭环。

## 9. 运行评测并解释失败

- [ ] 执行 `pnpm eval:smoke`，说明为什么 Mock 不算公开成绩；
- [ ] 执行 `pnpm eval:live` 与 `pnpm eval:report`；
- [ ] 在 Evaluations 页面确认结果来自同一数据库记录；
- [ ] 阅读 `docs/evaluation-report.md` 中从 21/26 到 26/26 的失败历史；
- [ ] 任选一个失败，说明实际输出、根因、修复和为什么没有放松安全门禁；
- [ ] 能解释当前 26/26 只能代表固定 Demo 集，不能外推所有行业。

**留存证据：** Run ID、指标、失败明细或历史失败复盘。

## 10. 独立完成三分钟演示

- [ ] 关闭 AI 助手和演示提示，只打开产品与必要控制台；
- [ ] 按 `docs/demo-script.md` 在三分钟内完成；
- [ ] 覆盖 RAG 引用、订单 Tool Call、无答案接管和后台闭环；
- [ ] 说清模型能做什么、不能做什么；
- [ ] 让另一位听众复述项目价值，确认五秒内能理解；
- [ ] 录制一次并修正停顿、无关页面和无法解释的术语。

**留存证据：** 三分钟录屏和一次不看稿现场演示。

## 投递前附加门禁

- [ ] `pnpm validate`、`pnpm test:e2e`、真实 Smoke Test 和 production build 全部通过；
- [ ] 无痕窗口访问公开 Demo，HR 无需 Key；
- [ ] 1440×900、1280、768、390×844 均无水平滚动或遮挡；
- [ ] Lighthouse 四项分数已记录真实结果，未达标项有说明；
- [ ] Git 历史、前端 Source Map、日志和截图中没有密钥；
- [ ] README 的 URL、截图、评测日期和已知限制与线上状态一致；
- [ ] 未把 Demo 数据描述为真实客户、交易或商业成绩。

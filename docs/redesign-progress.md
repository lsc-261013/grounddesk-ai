# GroundDesk 求职展示改版进度

## 任务边界

- 依据：`GroundDesk 求职展示改版说明`（2026-09-16）。
- 分支：`codex/grounddesk-showcase-redesign`。
- 基线：`main@b7f0c83`。
- 允许范围：首页、公开 Demo、直接相关的展示样式/小组件/i18n/无障碍属性及必要前端测试。
- 禁止范围：后端、共享业务实现、数据库、认证、AI/RAG/Agent、环境变量与部署配置；不合并、不发布、不新增付费。

## 阶段 0：基线与保护检查

- 状态：完成。
- 已改文件：
  - `docs/redesign-progress.md`（本进度记录）。
- 验证结果：
  - 工作目录确认为 `C:\Users\27835\Desktop\grounddesk-ai`。
  - 原分支为 `main`，基线提交为 `b7f0c83`。
  - 创建分支前工作区无未提交修改。
  - 已建立独立分支 `codex/grounddesk-showcase-redesign`。
- 待办：读取现有首页、Demo、样式、状态流和测试，完成 P0 诊断。
- 阻塞：无。
- 下一步：列出精确修改文件与可复用交互，记录公开/本地可用性证据。

## 阶段 1：P0 诊断

- 状态：完成前端范围内诊断；外部服务实测待核实。
- 已改文件：
  - `apps/web/src/stores/showcase.ts`（拆分商品与评测的请求和状态）。
- 验证结果：
  - 源码确认商品与评测原先通过单个 `Promise.all` 绑定；任一接口失败会丢弃另一个接口已经成功的数据。
  - 已改为商品、评测分别请求、分别记录加载与错误，同时保留兼容的聚合状态。
  - 公网只读探测受当前执行环境网络策略影响，没有得到可判定结果，未记录为通过或失败。
  - `pnpm env:check` 在启动脚本前因 Node `uv_os_get_passwd` 返回 `ENOMEM` 中止；尚未证明是项目错误，待改用工作区运行时重试。
- 待办：验证两个公开 GET 端点；不消耗模型额度的本地回归；问答、引用与接管仅在现有额度可确认时实测。
- 阻塞：公网状态尚未核实；本机默认 Node 运行时出现系统级 `ENOMEM`。
- 下一步：使用工作区运行时完成类型检查、单测、构建和页面回归；外部状态无法确认时保持“未验证”。

## 阶段 2：首页改版

- 状态：实现完成，待自动化与视觉验证。
- 已改文件：
  - `apps/web/src/views/FoundationView.vue`（重排为价值首屏、三种结果、项目证据和技术边界）。
  - `apps/web/src/components/SupportPreview.vue`（明确标注为非实时的界面示例）。
  - `apps/web/src/styles/landing.css`（深色首屏、浅色工作台与响应式视觉系统）。
  - `apps/web/src/i18n.ts`（首页中英文文案）。
- 验证结果：
  - 首页不再等待商品接口；评测接口失败时独立显示不可用状态。
  - 删除首页对口径存疑的 Retrieval@5 展示；不修改后端评测实现。
  - 示例内容明确标注“不是实时生成”，没有把静态预览冒充模型结果。
- 待办：类型检查、i18n 键一致性、桌面/移动端截图与无溢出检查。
- 阻塞：无。
- 下一步：完成 Demo 同步验证，再集中修复检查结果。

## 阶段 3：公开 Demo 改版

- 状态：实现完成，待自动化与视觉验证。
- 已改文件：
  - `apps/web/src/views/DemoView.vue`（聊天优先、推荐场景只填入、输入区持续可见）。
  - `apps/web/src/components/DemoChatMessage.vue`（回答、轨迹、引用、工具和接管状态）。
  - `apps/web/src/components/DemoEvidencePanel.vue`（桌面资料区、订单上下文、折叠商品资料与独立错误重试）。
  - `apps/web/src/styles/demo.css`（约 2:1 桌面布局、移动端对话优先与可读字号）。
  - `apps/web/src/i18n.ts`（Demo 中英文文案）。
- 验证结果：
  - 商品加载与问答入口解耦；商品失败不会遮挡输入框。
  - 三个推荐场景只写入输入框并聚焦，不自动触发 API。
  - 技术轨迹默认收起；移动端引用在消息内展开，桌面端使用右侧资料区。
- 待办：类型检查、单测、构建、E2E 状态与视觉回归。
- 阻塞：真实模型额度未确认，本阶段不主动发起收费调用。
- 下一步：格式化改动文件并运行工程检查。

## 阶段 4：响应式与状态回归

- 状态：完成。
- 已改文件：
  - `apps/web/src/stores/chat.ts`（保证流式事件更新响应式消息对象）。
  - `apps/web/tests/demo-evidence-panel.test.ts`（资料面板空状态挂载回归）。
  - `apps/web/tests/showcase.test.ts`（商品成功、评测失败时的数据隔离回归）。
  - `apps/web/e2e/grounddesk.spec.ts`（更新首页与 Demo 的既有断言）。
  - `apps/web/e2e/visual-audit.spec.ts`（目标尺寸、回答态、错误态和截图证据）。
- 验证结果：
  - `pnpm typecheck` 通过：shared、API、Web。
  - `pnpm lint` 通过。
  - `pnpm test` 通过：26 个测试文件、97 项测试。
  - `pnpm build` 通过：shared、API、Web；第一次 API 构建被 Windows 沙箱目录权限阻止，沙箱外原命令复跑通过。
  - Playwright 基础公开页回归通过：双语、Locale 持久化、reduced motion 和 390px 无横向溢出。
  - Playwright 视觉验收通过：1440×900、1280×800、390×844；包含确定性回答态和可恢复错误态。
  - 视觉验收曾发现引用面板不更新；根因是 SSE 事件修改数组外原始对象。改为更新 Pinia 中的响应式对象后，组件测试和浏览器验收均通过。
- 待办：整理交接清单、未验证项、演示脚本和撤回方法。
- 阻塞：无本地阻塞。
- 下一步：完成交接文档并保留本地预览供验收。

## 阶段 5：预览与交付

- 状态：完成，等待项目所有者验收。
- 已改文件：
  - `docs/redesign-handoff.md`（改动摘要、验证、三分钟脚本、五个关键点、未验证项与撤回方法）。
  - `docs/images/redesign-*.png`（六张目标尺寸与状态截图）。
- 验证结果：
  - 本地生产预览运行于 `http://127.0.0.1:4173`。
  - `git diff --check` 通过。
  - 差异范围检查确认 `apps/api`、`packages/shared`、`supabase` 与部署配置没有改动。
  - 2026-09-16 线上只读检查：`/health` HTTP 200，免费实例唤醒约 20 秒；公开商品和最新评测端点均为 HTTP 500。
  - 由于线上两个公开数据端点失败，本轮没有执行真实模型问答，也没有把线上商品、评测、引用、接管标记为通过。
- 待办：项目所有者查看本地预览和截图，决定是否接受、继续微调或另行安排后端故障修复。
- 阻塞：线上公开数据端点 HTTP 500 属于后端/服务范围，本轮按边界只记录不修改。
- 下一步：停止扩展；不合并、不推送、不部署。

## 阶段 6：验收反馈修复

- 状态：完成；前端反馈和恢复后的真实链路均已验证。
- 已改文件：
  - `apps/web/src/components/DemoChatMessage.vue`（移除访客消息中重复的“你”标签；增加明确失败状态）。
  - `apps/web/src/stores/chat.ts`（网络失败时结束占位状态并显示双语可恢复提示）。
  - `apps/web/src/i18n.ts`、`apps/web/src/styles/demo.css`（失败状态文案与视觉反馈）。
  - `apps/web/tests/demo-chat-message.test.ts`、`apps/web/tests/chat.test.ts`（访客标签和网络失败回归）。
- 验证结果：
  - Web TypeScript 类型检查通过。
  - 全仓 ESLint 通过。
  - Web 测试通过：7 个测试文件、16 项测试。
  - Web production build 通过。
  - 当前本地 `.env` 未配置 `VITE_API_BASE_URL`，4173 预览会回退请求 `http://localhost:8787`。
  - 部署 API 的 CORS 仅允许 `https://grounddesk-ai-lsc.onrender.com`，不允许本地 `http://127.0.0.1:4173`。
  - 正式商品接口在正式站点 Origin 下仍返回 HTTP 500；聊天预检 CORS 正常。
  - `pnpm db:verify` 返回 `tenant/user postgres.lxerwevpyucbdgvhnrcr not found`；对应 Supabase 项目域名也无法解析。连接串项目引用与 `SUPABASE_URL` 一致，因此当前证据指向 Supabase 项目暂停、删除或连接信息失效，而非页面请求代码。
  - 项目所有者恢复 Supabase 后，`pnpm db:verify` 通过：8 个商品、30 个订单、向量基础设施、混合检索函数、8 条迁移及 26 张 RLS 表均有效。
  - 正式站点 Origin 请求公开商品接口返回 HTTP 200 和 8 件商品；Render 免费 API 无需手动处理并已由请求唤醒。
  - 真实问答通过：问题“LinkCore C240 线材的保修期是多久？”完成理解、检索、校验、流式生成和完成事件，回答 18 个月有限保修，并返回《Avenlo 配送、退货与保修政策》的真实引用片段。
  - 本地开发页 `http://localhost:5173/demo` 和本地公开商品接口均返回 HTTP 200，可用于验收未部署的前端修复。
- 待办：项目所有者在本地开发页进行视觉与交互验收；本轮仍不合并、不推送、不部署。
- 阻塞：无。
- 下一步：等待项目所有者验收，不自行扩展范围。

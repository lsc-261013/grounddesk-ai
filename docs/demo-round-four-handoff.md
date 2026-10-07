# GroundDesk 第四轮交接：可靠切换、真实登录与视觉精修

技术验收日期：2026-10-06。本文记录本地改版与真实 connected 检查，不代表最新线上验收；首次交付未推送/合并/部署。随后用户授权 GitHub 发布，发布分支与结果另行记录。没有新付费资源。

## 2026-10-07 线上发布补充

应用发布合并为 `1f4845f`，所有者在现有前端/API 各执行一次 Deploy latest commit 并确认两端出现该提交。公开前端资源已更新为 `index-D9bkYoGu.js` / `index-CKnVLBzN.css`，API health 200 / connected；实际 Chromium 线上 Smoke 3/3，通过真实 RAG/来源、订单、拒答接管，以及两角色登录/刷新/退出/服务端权限和双语手机布局。拍摄动画终态后，真实业务用例单独复查 1/1，通过。

新证据目录 `docs/images/release-2026-10-07/`；详情与平台读取限制见 [发布记录](release-2026-10-06.md)。这些检查补充而非覆盖下文首次本地交付的历史记录。不宣称全套业务评测、Lighthouse、真实退款或外部通知复验通过。

## 验收反馈补充：三个场景按钮兼作重播

本段覆盖下文原交付版本的“手动切换 180ms、重复当前标签不重播、独立重播按钮”规则。按用户最新要求，每次点击产品咨询、订单查询或人工接管，都播放该场景的问题 → 结果 → 依据/下一步完整动效；再点当前标签也重新播放。独立重播按钮已删除，首次入场、无悬停冻结、快速切换最终选择、键盘和 reduced motion 均保留。

补充版本仅改首页组件/CSS/已不使用的双语文案及对应测试、截图和进度；不涉及登录或 AI 业务。补充 `pnpm validate` 全部通过（141/141），相关浏览器回归 14/14；不是重复进行两角色登录或真实模型评测。主入口现约 516.98kB / gzip 160.77kB，体积警告未消除。

桌面/手机 `after-home-*`、`after-stage-*` 及 `hero-motion-1440x900.webm` 已更新为标签重播版本，录屏约 14 秒；此前单独导出的 `motion-*` 时间帧属于原版本，不作为此次反馈证据。补充实看画面为 `tab-replay-native-order.jpg`、`tab-replay-motion-frame.png`。

按钮重播补充提交：`299599d`（`fix(web): replay workflows directly from scenario tabs`）。若只撤回该反馈修改，工作区干净时可 `git switch --detach 955ba4f` 查看原第四轮，或在当前分支 `git revert 299599d` 保存反向提交；有未提交修改先备份。GitHub 发布不自动授权其他外部操作。

## 预览与版本

- 首页：<http://localhost:5173/>。
- 公开问答：<http://localhost:5173/demo>。
- 登录：<http://localhost:5173/login>。
- API：本地 8787，沿用 connected 模式及既有服务、账号和业务数据。
- 分支：`codex/demo-experience-round-four`；第三轮基线 `74ea32a8e4ef939233f6501089f4699c86bda2ca`。开始时工作区干净。
- 基础修复提交 `955ba4f`；标签重播调整提交 `299599d`。后续文档提交不会改变这两个实现版本。线上是否对应当前代码，以 Render Deployment 提交与实际验收为准。

## 两类故障的根因与证据

### 场景第一次切换看似空白

第三轮每次点击都重新挂载带延迟的入场节点；悬停规则暂停全部子动画，`both` 填充使尚未入场的回答/依据停在透明状态。再次移开鼠标才恢复，并非需要第二次点击才能获取数据。

当前取消影响可读性的悬停/离屏暂停；首次进入视口播放一次，此后每次点击三个场景按钮都重新执行问题、回答、依据的分层入场，点击当前标签同样重播。无需额外重播按钮。快速连续切换只保留最后选择，基础内容不依赖动画完成才存在；观察器缺失或失败不阻挡阅读，reduced motion 完整静态展示。基础修复曾采用短切换过渡，已由 `299599d` 按用户反馈替换。

浏览器实际覆盖首次进入、切换后立刻悬停、重复和连续快速切换、最后选择生效、重播、离开再返回、键盘 Home/End、按钮悬停/按下与下方一次性出现。断言当前场景的文本及回答/依据最终可见，而非只检查动画名称。首页这些操作的模型请求数为 0。

### 演示账号登录失败

| 阶段                      | 修复前实际结果            | 修复后实际结果               |
| ------------------------- | ------------------------- | ---------------------------- |
| 浏览器 Supabase 密码认证  | 200                       | 200                          |
| GroundDesk 工作区会话     | 401，并重复请求两次       | 单次 200                     |
| Node 公开 JWKS 直连       | fetch failed / ECONNRESET | 采用已有代理后 200           |
| 同机器系统 HTTP 请求 JWKS | 200                       | 200                          |
| 管理员 / 客服角色与工作区 | 未成功进入                | 两者均真实进入，权限分别验证 |

前后端 Supabase URL 与公开 key 一致。实际失败在 Node 端认证校验的网络连接，不是公开密码过期。只读确认 Windows 已启用本机 HTTP 代理后，用独立 Node 进程作直连/代理对照，再仅重启项目 API 使用该既有代理；没有更改 Windows 代理、TLS 验证、套餐、账号、密码或 `.env`。

- 服务端仍用 Supabase `getClaims` 验证身份，再进行成员/角色/Workspace 校验。网络和供应商不可用映射 503，无效或过期 token 仍为 401；不将连接失败误报为凭据错误。
- 前端按配置、凭据、认证连接、工作区连接、工作区权限和会话失效分类；中英文都给出相应下一步。初始化恢复失败独立显示，不在尚未提交的登录表单冒充本次登录失败。
- 初始化合并、相同 token 的会话请求去重、旧响应版本防护；退出时清空工作区权限，避免在途成功响应重新赋权。
- 管理员实际访问并刷新订单、读取设置/商品、预览已处理知识切块；客服实际刷新工单页，设置与商品直达显示无权限，导航不提供管理员入口。两种角色退出完成后，受保护路由均回登录页。
- `auth:smoke` 实际结果：管理员 session/settings 200，客服 session 200/settings 403，两个角色跨 Workspace 均 403。

参考：[Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims)、[密码登录](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)、[Node 进程代理配置](https://nodejs.org/api/cli.html#node_use_env_proxy1)。`getSession` 用于浏览器恢复，不替代服务端校验。

## 视觉取舍与实际迭代

Vue 设计 Skill 在本轮用于响应式布局、状态反馈和无额外动效框架实现；Supabase Skill 用于核对官方身份校验边界。没有采用模板或全量重写。

- 保留森林绿识别、标题和真实业务意义；改为结果中心的紧凑构图。取消竖向三步侧轴及夸张叠层，只留下细线轮廓，问题与明亮的本地产品示意并排，回答和依据用明暗分层。
- 1440×900 和 1280×720 比例重新平衡；1280×720 下舞台底部约 710px，关键结果和体验入口在首屏。手机自然单列滚动，不缩字强塞。
- 证据为青绿、接管为暖米色/橙色；示例仍明确非实时，不补客户或成绩数字。没有自动轮播打断选择。
- 初次看手机截图发现 SVG 固定宽度超出图框并被裁切，改为按容器收缩，重新检查中英文三场景；英文接管长文调整行高/容器空间。
- 动效约 0.9 秒完成首轮分层，手动切换迅速、重播独立。检查约 6 秒真实 UI 录屏及 0.8 / 2.1 / 2.7 / 3.1 秒代表帧：可观察首次依据尚在淡入、切换后结果可读、重播恢复、滚动返回，不存在残余暂停。
- 初始截图捕获误把同一画面标成多个视口，已从第三轮提交在项目内隔离预览重拍 1440×900、1280×720、390×844 PNG；错误标注的初始捕获不作为交付对照。隔离预览未获取模型答案，随后关闭。
- 一轮退出测试在点击退出后马上做整页导航，取消了尚未完成的退出请求。修正为先确认退出完成，再检查受保护路由；重跑通过。这是测试操作时序修正，不把失败运行计为通过。

## 修改清单

| 模块                    | 文件                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页构图、切换和兜底    | `apps/web/src/components/SupportPreview.vue`、`composables/useViewportEntrance.ts`、`styles/landing.css`、`styles/support-preview.css`                        |
| 登录状态与双语提示      | `apps/web/src/stores/auth.ts`、`lib/auth-errors.ts`、`lib/supabase.ts`、`views/LoginView.vue`、`i18n.ts`                                                      |
| 服务端验证错误边界      | `apps/api/src/auth/supabase-auth-verifier.ts`                                                                                                                 |
| 安全的本地诊断/可选启动 | `apps/api/src/auth/diagnose-auth.ts`、`scripts/dev-api-with-system-proxy.ps1`                                                                                 |
| 新增/回归检查           | API verifier 单元，Web Auth 单元，`auth-diagnostic.spec.ts`、`auth-errors.spec.ts`、`demo-round-four.spec.ts`、`grounddesk.spec.ts`、三轮来源与四尺寸布局回归 |
| 本轮证据                | `docs/demo-round-four-progress.md`、本交接、`docs/images/demo-round-four/`                                                                                    |

已有来源组件、Demo 聊天逻辑、订单/退货 Agent、数据库、RLS、Auth 账号、路由定义、部署配置、依赖和锁文件未改。第三轮来源展开记忆、精确编号、手机返回草稿/焦点和局部滚动保留；旧悬停暂停测试被第四轮可见结果测试替代，不保留过时的跳过项来凑通过数。

## 验证层级与复现

- `pnpm validate`：typecheck、lint、单元/集成、production build 全部通过；本轮 **141/141**（API 103、Web 35、shared 3）。不是继承旧轮次数字。
- 相关 Chromium E2E **23/23**；添加两角色截图后又单独重跑这两项 **2/2**，不把重复运行计成额外覆盖。
- 四宽度 1440 / 1280 / 390 / 320 × 中英文 × 三场景，验证无横向溢出、文本落在容器内、卡片不碰撞、场景高度稳定；正常动态及 reduced motion 分别检查。
- 五类认证错误为隔离测试：错误凭据、Auth 连接失败、API 503、API 401、API 403；恢复失败不污染提交状态，失败后可再次操作，错误状态不给受保护路由赋权。单元额外覆盖去重、成功重试和退出后旧成功响应。
- 问答回归为隔离夹具：商品失败/重试、等待与草稿/IME、HTTP/SSE 失败、无来源与确认接管区别、长回答阅读、工具与引用共存、来源所有权/重复点击/手动折叠/手机返回。夹具不冒充真实供应商或工单。
- 真实 connected 问答本轮最终复查 **1 次**：S1 Pro 支持双设备，S1 不支持；实际返回两条产品手册引用，第二条展开为 S1 对应原文。商品资料真实加载 8 件。正常增加一条问答记录，不重置业务数据。
- 最终本地敏感值对照：291 个源码/文档/前端构建文件对比 4 个已配置的服务端敏感值，匹配数 0；`.env` 仍被 Git 忽略。没有打印密钥/令牌。预览三个入口和 API health 均 200。

主要复现命令（项目根目录；已有服务不要重复启动）：

```powershell
pnpm validate
$env:E2E_BASE_URL = 'http://localhost:5173'
pnpm --filter @grounddesk/web exec playwright test e2e/auth-errors.spec.ts e2e/auth-diagnostic.spec.ts e2e/demo-experience.spec.ts e2e/demo-round-two.spec.ts e2e/demo-round-three.spec.ts e2e/demo-round-four.spec.ts e2e/home-stage-layout.spec.ts e2e/grounddesk.spec.ts --grep-invert 'live demo cites|reset the Demo'
pnpm auth:smoke
```

### 本地重新启动

当前 Web 和 API 已运行。网络允许 Node 直连时仍可 `pnpm dev`。在本机已证实需要现有代理的情况下，分别开两个项目根目录终端：

```powershell
# Terminal 1: adopts the existing loopback proxy for this API process tree only.
powershell -NoProfile -File .\scripts\dev-api-with-system-proxy.ps1

# Terminal 2
pnpm dev:web
```

可选脚本需要 Node 22.21+ 或 24.5+；本轮实用版本为 24.19。脚本只读既有代理，确认是 loopback 且 8787 未占用，否则停止并说明；不安装代理、不改注册表、不关闭证书校验、不修改部署或系统执行策略。

直连网络下 `pnpm auth:smoke` 可直接运行；本机如需进程代理，在该终端使用与可选脚本相同的 `NODE_USE_ENV_PROXY` / `HTTPS_PROXY` / `NO_PROXY` 临时设置后运行。不要把密钥发到聊天或加入脚本。

## 截图与动效

目录：`docs/images/demo-round-four/`。

| 证据                   | 文件                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| 1440×900 同尺寸对照    | `before-home-1440x900.png` → `after-home-1440x900.png`                                          |
| 1280×720 同尺寸对照    | `before-home-1280x720.png` → `after-home-1280x720.png`                                          |
| 390×844 同尺寸对照     | `before-home-390x844.png` → `after-home-390-zh.png`                                             |
| 手机完整舞台           | `after-stage-390-zh-0.png`、`after-stage-390-en-2.png`、`after-stage-320-en-2.png`              |
| 真实两角色工作台       | `live-admin-1440x900.png`、`live-agent-1440x900.png`                                            |
| 真实问答第二条引用     | `live-source-two-1440x900.jpg`                                                                  |
| 隔离来源归属/手机定位  | `fixture-source-owner-1440x900.png`、`fixture-source-390x844.png`                               |
| 隔离异常/等待/工具共存 | `fixture-error-390x844.jpg`、`fixture-waiting-390x844.jpg`、`fixture-order-source-1440x900.png` |
| 正常动效 UI 录屏       | `hero-motion-1440x900.webm`                                                                     |

PNG 为精确测试尺寸；内置浏览器 JPEG 按其截图编码尺寸保存，名称表示请求视口。首页静态对照使用 reduced motion / 动画终态；正常动效另有真实 Chromium 录屏。`live-*` 来自实际服务，`fixture-*` 仅证明界面状态，不代表真实模型或业务成绩。

## 未验证与边界

- 2026-10-07 已补线上 Chromium 独立上下文验收；Render 控制台 Live 截图、Deployment ID/构建日志未独立读取。Safari/Firefox、实体手机软键盘、屏幕阅读器、Lighthouse、完整 WCAG 或 60fps 未复测；不提供新性能分数。
- 未重跑全部真实模型评测、真实订单/退货审批/客服回复/Webhook 端到端；相关现有 API 自动化和 UI 隔离回归通过，不宣称整套业务重新验收。
- 网络失败的 SDK 退出持久化行为未做浏览器级断网重载验证；单元只证明本地 store 清空，不能当成 SDK 持久化清除的证据。
- 当前 Vite 主入口约 516.98kB，gzip 160.77kB，超过 500kB 的构建警告仍存在；没有为这次修复扩大到分包改造。
- 本地 Node 网络依赖既有代理正在可用；若代理关闭/变更，仍会明确显示认证连接/工作区错误，代码不能替用户恢复外部网络。
- 没有新客户、虚假用户、改写指标、外部账号操作或真实订单写入；没有个人作品集/简历修改。

## 验收与安全撤回

1. 首页第一次打开后切订单，再切产品并把鼠标停在结果上；每次点击都播放完整分层动效。再点当前标签也重播，不能因悬停冻结；连续切换和滚动返回都应保持最终选择。
2. 打开 Demo，用兼容性示例发送一次；总入口与正文第二条分别核对原文，再在手机宽度返回问答，草稿与入口焦点保留。
3. 用 README 公布的管理员、客服身份分别登录。刷新、退出后访问控制台，检查权限不串角色；不要使用真实顾客资料。

需要回到第三轮时，先停止本地服务；**工作区干净**时 `git switch codex/demo-experience-round-three`，按原方式启动并刷新。第四轮分支仍保留，可随时切回；若有新修改先提交或备份，禁止 `reset --hard` 或覆盖已有修改。

若以后合并过，使用 `git revert <第四轮提交 SHA>` 创建反向提交，不改写历史。本轮无数据库迁移/账号变更需要撤回；真实问答记录不会因切分支删除。停止可选代理启动的项目 API 后，该进程树的代理配置随之结束，系统配置始终未改。

本轮达到约定范围后结束 Goal，交用户验收；不继续追加功能或自动上线。

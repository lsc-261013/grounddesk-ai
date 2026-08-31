# GroundDesk 部署手册

## 目标拓扑

```mermaid
flowchart LR
  Browser[浏览器] -->|HTTPS| RenderStatic[Vue 3 / Render Static Site]
  Browser -->|HTTPS + SSE| RenderAPI[Fastify / Render Web Service]
  Browser -->|Auth only| SupabaseAuth[Supabase Auth]
  RenderAPI --> Supabase[(PostgreSQL + pgvector)]
  RenderAPI --> Storage[Private Storage]
  RenderAPI --> DeepSeek[DeepSeek]
  RenderAPI --> SiliconFlow[SiliconFlow]
  RenderAPI -->|HMAC webhook| Customer[客户系统]
```

前端只持有 Supabase Publishable Key。Secret Key、数据库连接串、DeepSeek Key 和 SiliconFlow Key 只配置在 Render。部署不会创建 Render Postgres，因为 GroundDesk 的数据库、Auth、Storage 与 pgvector 统一由 Supabase 托管。

当前已验证环境：

- Web：https://grounddesk-ai-lsc.onrender.com
- API：https://grounddesk-api-lsc.onrender.com
- Health：https://grounddesk-api-lsc.onrender.com/health

## 1. 部署前门禁

在干净工作区执行：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm env:check
pnpm validate
pnpm test:e2e
```

`pnpm env:check` 只输出配置状态，不输出密钥。公开环境必须显示 `runtimeMode: connected`，并且 database、generation、embedding 都为 `true`。

2026-08-31 的公开健康检查已满足上述条件。

## 2. Supabase

### 2.1 项目配置

从 Supabase Dashboard 取得：

- Project URL → `SUPABASE_URL` 与 `VITE_SUPABASE_URL`；
- Publishable Key → `SUPABASE_PUBLISHABLE_KEY` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`；
- Secret Key → 仅 `SUPABASE_SECRET_KEY`；
- Connect → PostgreSQL connection string → 仅 `SUPABASE_DB_URL`。

数据库密码不是连接串。连接串包含主机、端口、数据库用户、密码和数据库名；密码中的 `@`、`:`、`/`、`#`、`%` 等保留字符必须进行百分号编码。优先复制 Dashboard 生成的 URI 并只替换其中的密码占位符。

### 2.2 初始化

在根目录 `.env` 完成服务端配置后执行：

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm auth:bootstrap
pnpm auth:smoke
pnpm knowledge:bootstrap
pnpm knowledge:smoke
```

迁移使用版本号与 SHA-256 校验和，可安全重跑。Seed 使用稳定主键与相对初始化日期，重跑不会把 8 个商品、30 个订单和评测用例重复插入。`knowledge:bootstrap` 会产生真实 Embedding 用量。

### 2.3 Auth URL

部署前在 Supabase Auth → URL Configuration 设置：

- Site URL：最终 Render Static Site URL；
- Redirect URLs：最终 Render Static Site URL 及其 `/login`、`/onboarding` 路径；
- 本地开发保留 `http://localhost:5173/**`。

Demo 管理员和客服由 `pnpm auth:bootstrap` 创建并确认邮箱。普通注册是否要求邮件确认由 Supabase Auth 策略决定；不要为了演示关闭生产项目的安全控制。

## 3. Render API

仓库根目录的 `render.yaml` 定义构建、迁移、启动、健康检查和非敏感默认值。它不会写入任何密钥。根据 [Render Blueprint](https://render.com/docs/blueprint-spec) 创建服务，并在首次导入时填写所有 `sync: false` 项。

必须填写：

| 变量                       | 值                                           |
| -------------------------- | -------------------------------------------- |
| `WEB_ORIGIN`               | 最终 Render Static Site Origin，不带末尾斜杠 |
| `SUPABASE_URL`             | Supabase Project URL                         |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key                     |
| `SUPABASE_SECRET_KEY`      | Supabase Secret Key                          |
| `SUPABASE_DB_URL`          | 已正确编码密码的 PostgreSQL URI              |
| `DEEPSEEK_API_KEY`         | DeepSeek 服务端 Key                          |
| `SILICONFLOW_API_KEY`      | SiliconFlow 服务端 Key                       |

Render 自动提供 `PORT`；API 会优先使用显式 `API_PORT`，否则读取 `PORT`，并绑定 `0.0.0.0`。健康检查路径是 `/health`。

开发联调阶段使用 Render Free Web Service（0.1 CPU / 512 MB）和免费 Static Site，不要求绑定付款方式。Free API 空闲 15 分钟后会休眠，下一次请求可能需要约一分钟唤醒，因此只作为开发期环境；投递简历前再经项目所有者确认升级为常驻实例。Free 实例不支持 Pre-deploy Command，幂等迁移暂时放在 API Build Command 中执行；升级付费实例后应恢复为独立的 Pre-deploy Command。

Render 的 Node 镜像已经提供 pnpm shim，不要在 Build Command 中执行 `corepack enable`。真实首次部署曾因此尝试删除只读的 `/usr/bin/pnpm` 并以 `EROFS` 失败；当前 Blueprint 直接执行 `pnpm install --frozen-lockfile`，修复后 API 与 Static Site 均成功上线。

首次部署后验证：

```text
GET https://<render-host>/health
```

响应应为 `status: ok`、`runtimeMode: connected`，三个 Provider 状态均为已配置。

## 4. Render Static Site

同一份 `render.yaml` 定义 Vue Web 构建、`apps/web/dist` 发布目录、Vue Router SPA Rewrite、安全响应头和长期缓存。通过 Render Blueprint 导入仓库时，API 与 Static Site 一次创建；只有 Supabase 两项前端公开值需要在 Dashboard 填写。

配置 Production 环境变量：

| 变量                            | 值                                       |
| ------------------------------- | ---------------------------------------- |
| `VITE_API_BASE_URL`             | Render API HTTPS Origin，不带末尾斜杠    |
| `VITE_SUPABASE_URL`             | Supabase Project URL                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key                 |
| `VITE_GITHUB_URL`               | 最终公开仓库 URL；未配置时页面隐藏该入口 |
| `VITE_AUTHOR_NAME`              | 落地页与页脚展示的公开作者名             |
| `VITE_CONTACT_URL`              | 公开联系入口，例如作品集或职业邮箱链接   |

`VITE_` 变量会进入前端构建产物，因此只能放公开值。任何 Secret Key、数据库连接串或模型 Key 都不得使用 `VITE_` 前缀。仓库、作者和联系链接已作为非敏感 Blueprint 值提交；API Origin 和 Web CORS Origin 通过 `fromService` 引用 Render 自动注入的 `RENDER_EXTERNAL_URL`，避免硬编码平台子域。

Blueprint 首次分配域名后，核对 API `/health` 和浏览器网络请求使用实际 `onrender.com` Origin。最后回到 Supabase 更新 Site URL / Redirect URLs，完成 Auth 闭环；Blueprint 每次同步都会让两个跨服务 Origin 跟随平台 URL。

## 5. 生产初始化与真实验收

部署环境数据库完成迁移后，仅执行一次 Demo 初始化；后续重置从控制台触发：

```bash
pnpm db:seed
pnpm auth:bootstrap
pnpm knowledge:bootstrap
pnpm eval:live
pnpm eval:report
```

真实评测会产生少量 DeepSeek 与 SiliconFlow 费用。验收顺序：

1. 无痕窗口打开落地页，确认不依赖登录即可看到真实评测；
2. 打开 `/demo`，完成引用问答、订单查询和无答案接管；
3. 用管理员账号登录，检查文档、Chunk、会话、工单和评测；
4. 用客服账号登录，确认看不到设置和商品写入入口，只能处理分配工单；
5. 在 1440×900、1280、768 与 390×844 下检查布局；
6. 运行 Lighthouse，记录 Performance、Accessibility、Best Practices、SEO；
7. 检查前端 Source、网络响应和 Git 历史中不存在密钥。

部署后的浏览器主路径不需要另写临时脚本。把 Playwright 指向公开 Web Origin，即可跳过本地 Dev Server 并复用仓库中的真实验收：

```powershell
$env:E2E_BASE_URL = 'https://your-public-web-origin.example'
$env:E2E_LIVE_AI = 'true'
pnpm test:e2e
```

如需重新录制四视口证据，再设置 `$env:E2E_VISUAL_AUDIT = 'true'`。`E2E_RESET_DEMO` 默认关闭，因为它会清空 Demo 运营记录；仅在确认需要恢复公开演示基线时临时开启。

## 6. 更新、回滚与故障定位

- Render 每次部署前运行 `pnpm db:migrate`；只允许前向、可重复迁移，不在自动流程中运行 Seed。
- Render Static Site 静态资源带内容 Hash，可以回滚到上一成功 Deployment；API 回滚前确认新迁移是否向后兼容。
- `/health` 正常但聊天失败：检查 Provider 状态、Render 出站网络和用量额度。
- 登录成功但 API 返回 401：检查 Supabase 项目是否一致，以及浏览器 Access Token 是否来自同一 Project URL。
- 浏览器出现 CORS：`WEB_ORIGIN` 必须与地址栏 Origin 完全一致。
- 数据库连接失败：重新复制连接 URI，并检查特殊字符编码、IPv4/Pooler 选择和 Supabase 网络限制。
- 前端刷新子路由 404：确认 Render Static Site 已同步仓库中的 `/* → /index.html` Rewrite。

## 7. 密钥轮换

密钥只写入本地 `.env` 和 Render Secret Environment Variables；Vite 构建变量只允许放 API Origin、Supabase Publishable Key、仓库链接和公开作者资料。发生疑似泄漏时先在供应商侧轮换，再更新 Render，最后检查日志和 Git 历史。Webhook 每个 Endpoint 有独立签名密钥，创建时只显示一次；数据库仅保存由服务端主密钥派生加密键加密后的密文。

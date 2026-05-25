# VISION BRZAZIL 电商视觉生成器

一个本地静态 Web MVP，用于把产品图片、卖点描述和商品链接拆解为巴西市场可用的图片生成提示词与商品详情页提示词。

## 功能

- 上传多张产品图并预览。
- 输入商品链接，自动拆解域名、平台线索、商品 ID、路径关键词和查询词。
- 支持多条产品链接：可同时粘贴美国竞品链接和巴西本地链接，分别拆解卖点、设计方向、主图详情页方向和本地化优化线索。
- 输入中文卖点，生成面向巴西葡语市场的图片提示词和详情页提示词。
- 覆盖 Amazon Brasil、Mercado Livre、TikTok Shop、Shopee Brasil 和四平台通用方案。
- 链接拆解、图片提示词和详情页生成默认第一优先级使用 `ChatGPT 5.5 Pro 最高级模型`，接口草案模型 ID 为 `gpt-5.5-pro`。
- 保留 Gemini、Claude、ComfyUI、本地模型和纯提示词模式作为备用 API 选项。
- 支持人工修正关键词：手动输入关键词后会覆盖自动拆解关键词，用于图片生成和详情页生成。
- 支持主管理员和子账号模拟：平台权限、模型权限、额度、状态、最近使用记录和全局监控。

## 使用

直接用浏览器打开 `index.html` 即可使用。

## 接入真实 API

当前前端会优先调用 `/api/generate`。如果部署环境不支持后端函数，或没有配置 API Key，会自动回退到本地提示词演示模式。

不要把真实 API Key 写进 `app.js`、`index.html` 或提交到 GitHub。部署到 Vercel 时，在 Project Settings -> Environment Variables 添加：

- `OPENAI_API_KEY`: 你的模型 API Key
- `OPENAI_BASE_URL`: OpenAI 兼容接口地址，默认 `https://api.openai.com/v1`
- `OPENAI_TEXT_MODEL`: 文本生成模型，默认 `gpt-5.5-pro`

如果你使用的是第三方 OpenAI 兼容端口，只需要把 `OPENAI_BASE_URL` 改成你的 API Base URL，例如 `https://api.example.com/v1`。

前端发送给 `/api/generate` 的内容包括：账号信息、平台、产品链接、关键词、卖点、图片文件元信息、图片提示词和详情页提示词。后端会返回结构化 JSON，并把真实 `usage.total_tokens` 记录到 Dashboard。

## 公网部署

如果只用 GitHub Pages，这是纯静态站点，可以正常展示页面，但不能执行 `/api/generate` 后端函数。要调用真实 API，推荐部署到 Vercel。

Vercel 设置：

- Framework Preset: `Other`
- Build Command: `node --check app.js`
- Output Directory: `.`
- Environment Variables: 按“接入真实 API”填写 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_TEXT_MODEL`

Netlify 设置：

- Build Command: `node --check app.js`
- Publish Directory: `.`

GitHub Pages 设置：

- 将本目录推送到 GitHub 仓库。
- Repository Settings -> Pages。
- Source 选择 `Deploy from a branch`。
- Branch 选择 `main`，Folder 选择 `/root`。

当前版本的登录、子账号和用量记录仍使用浏览器 `localStorage` 模拟。公网演示可以用，但正式多电脑使用需要后端数据库和真实鉴权，否则每台电脑的数据不会共享。

默认内置 4 个账号：主管理员、设计子账号、运营子账号、审核子账号。当前版本使用 `localStorage` 模拟登录、权限和用量记录，后续接后端后应替换为真实鉴权、密码哈希、服务端 Session/JWT 和数据库隔离。

演示登录：

- 主管理员：`admin` / `admin123`
- 设计子账号：`creative-a` / `design123`
- 运营子账号：`ops-b` / `ops123`
- 审核子账号：`review-c` / `review123`

主管理员可以进入 Dashboard 查看全局账号、用量、权限和最近记录，并创建、暂停、启用子账号。子账号登录后只进入自己的生成工作台，只能使用被分配的平台、模型和额度。

Dashboard 监控指标包括：每个账号的使用次数、修改次数、成功生成次数、消耗 token、额度使用率和最近事件。当前 token 为前端估算值，接入真实模型 API 后应改为读取模型返回的 usage 数据。

## 后续可接入

- 后端图片生成接口：`/api/generate/openai`、`/api/generate/gemini`、`/api/generate/anthropic`。
- 登录与权限接口：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session`。
- 子账号与权限接口：`GET /api/admin/accounts`、`POST /api/admin/accounts`、`PATCH /api/admin/accounts/:id`、`POST /api/usage/events`。
- 商品链接实时抓取与结构化解析。
- 图片合规检测：白底占比、文字密度、水印、Logo、分辨率、平台规则。
- 批量 SKU 处理和导出 CSV / Excel / HTML 详情页。

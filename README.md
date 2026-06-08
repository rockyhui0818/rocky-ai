# VISION BRZAZIL 电商视觉生成器

一个本地静态 Web MVP，用于把产品图片、卖点描述和商品链接拆解为巴西市场可用的图片生成提示词与商品详情页提示词。

## 功能

- 上传多张产品图并预览。
- 输入商品链接，自动拆解域名、平台线索、商品 ID、路径关键词和查询词。
- 支持多条产品链接：可同时粘贴美国竞品链接和巴西本地链接，分别拆解卖点、设计方向、主图详情页方向和本地化优化线索。
- 输入中文卖点，生成面向巴西葡语市场的图片提示词和详情页提示词。
- 覆盖 Amazon Brasil、Mercado Livre、TikTok Shop、Shopee Brasil 和四平台通用方案。
- 链接拆解、图片提示词和详情页生成默认第一优先级使用 `ChatGPT 5.5 Pro 最高级模型`，接口草案模型 ID 为 `gpt-5.5`。
- 保留 Gemini、Claude、ComfyUI、本地模型和纯提示词模式作为备用 API 选项。
- 支持人工修正关键词：手动输入关键词后会覆盖自动拆解关键词，用于图片生成和详情页生成。
- 支持主管理员和子账号模拟：平台权限、模型权限、额度、状态、最近使用记录和全局监控。

## 使用

直接用浏览器打开 `index.html` 即可使用。

## 本机浏览器辅助扫描

Amazon、TikTok Shop 等平台经常会拦截服务器抓取，导致 VPS 后端只能拿到 `Continue shopping`、`Security Check` 或验证码页。为提高链接拆解质量，可以在使用网站前，在你的 Mac 上启动本机浏览器扫描助手：

```bash
node local-browser-scanner.js
```

启动后保持 Chrome 打开。前端会优先请求 `http://127.0.0.1:8787/scan`，使用你电脑上的 Chrome 打开产品链接，提取商品标题、评分、评论数量、商品图、详情页/A+ 图片和可见 review；本机助手不可用时会自动回退到 VPS 后端抓取。

如果扫描失败，请在 Chrome 菜单中开启 `View -> Developer -> Allow JavaScript from Apple Events`，并在 Amazon/TikTok 页面手动完成一次验证后重试。

## 接入真实 API

当前前端会优先调用 `/api/generate`。如果部署环境不支持后端函数，或没有配置 API Key，会自动回退到本地提示词演示模式。

不要把真实 API Key 写进 `app.js`、`index.html` 或提交到 GitHub。部署到 Vercel 时，在 Project Settings -> Environment Variables 添加：

- `OPENAI_API_KEY`: 你的模型 API Key
- `OPENAI_BASE_URL`: OpenAI 兼容接口地址，默认 `http://154.40.59.124:3000/v1`
- `OPENAI_TEXT_MODEL`: 文本生成模型，默认 `gpt-5.5`
- `OPENAI_REASONING_EFFORT`: 文本模型推理强度，默认 `high`；如果第三方兼容接口不支持该参数，后端会自动降级重试
- `OPENAI_MAX_COMPLETION_TOKENS`: 链接分析最大输出长度，默认 `1800`，用于加快返回速度
- `OPENAI_IMAGE_API_KEY`: 图片生成专用 API Key；不填时才回退使用 `OPENAI_API_KEY`
- `OPENAI_IMAGE_BASE_URL`: 图片生成专用 OpenAI 兼容接口地址，当前可用地址为 `http://154.64.230.35:3000/v1`；不填时才回退使用 `OPENAI_BASE_URL`
- `OPENAI_IMAGE_MODEL`: 图片生成模型，当前可用模型为 `gpt-image-2-pro`
- `BRIGHTDATA_API_KEY`: Bright Data Web Unlocker API Key，用于优先解锁 Amazon/TikTok 等会拦截服务器抓取的平台
- `BRIGHTDATA_ZONE`: Bright Data zone 名称，默认 `web_unlocker1`
- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service_role key，仅放后端环境变量，不能暴露到前端
- `SESSION_SECRET`: 任意长随机字符串，用于签发登录 token

如果你使用的是第三方 OpenAI 兼容端口，文本分析只需要把 `OPENAI_BASE_URL` 改成你的 API Base URL，例如 `http://154.40.59.124:3000/v1`。如果图片生成走另一家供应商，请单独配置 `OPENAI_IMAGE_BASE_URL` 和 `OPENAI_IMAGE_API_KEY`，避免文本分析 API 覆盖生图 API。

前端发送给 `/api/generate` 的内容包括：账号信息、平台、产品链接、关键词、卖点、图片文件元信息、图片提示词和详情页提示词。后端会返回结构化 JSON，并把真实 `usage.total_tokens` 记录到 Dashboard。

## Supabase 设置

1. 打开 Supabase 项目。
2. 进入 SQL Editor。
3. 复制并执行 `supabase/schema.sql`。
4. 进入 Project Settings -> API，复制 Project URL 到 `SUPABASE_URL`。
5. 复制 `service_role` key 到 `SUPABASE_SERVICE_ROLE_KEY`。注意不要使用 `anon public` key。

`supabase/schema.sql` 会创建 1 个主管理员账号和 3 个子账号用于初始化。正式上线后请立即在 Supabase 中修改初始密码哈希，或通过后台创建新的管理员账号后删除初始化账号。

配置 Supabase 后，其他电脑打开网站并用账号密码登录，会读取同一套云端账号、权限和用量记录。

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

主管理员可以进入 Dashboard 查看全局账号、用量、权限和最近记录，并创建、暂停、启用子账号。子账号登录后只进入自己的生成工作台，只能使用被分配的平台、模型和额度。

Dashboard 监控指标包括：每个账号的使用次数、修改次数、成功生成次数、消耗 token、额度使用率和最近事件。当前 token 为前端估算值，接入真实模型 API 后应改为读取模型返回的 usage 数据。

## 后续可接入

- 后端图片生成接口：`/api/generate/openai`、`/api/generate/gemini`、`/api/generate/anthropic`。
- 登录与权限接口：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session`。
- 子账号与权限接口：`GET /api/admin/accounts`、`POST /api/admin/accounts`、`PATCH /api/admin/accounts/:id`、`POST /api/usage/events`。
- 商品链接实时抓取与结构化解析。
- 图片合规检测：白底占比、文字密度、水印、Logo、分辨率、平台规则。
- 批量 SKU 处理和导出 CSV / Excel / HTML 详情页。

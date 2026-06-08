# VPS 部署方案

这个方案把前端页面和 `/api/*` 后端放在同一台 VPS、同一个域名下，避免 GitHub Pages 静态站、Render 免费冷启动、跨域和长请求超时造成的反复连接失败。

## 推荐服务器

- Ubuntu 22.04 或 24.04
- 1 核 1G 可以跑基础版，推荐 2 核 2G 以上
- 需要公网 IP

## 1. 安装基础环境

```bash
sudo apt update
sudo apt install -y git nginx curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. 拉取项目

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
git clone git@github.com:rockyhui0818/rocky-ai.git /var/www/rocky-ai
cd /var/www/rocky-ai
```

如果 VPS 没有 GitHub SSH key，也可以用 HTTPS：

```bash
git clone https://github.com/rockyhui0818/rocky-ai.git /var/www/rocky-ai
```

## 3. 填写后端环境变量

```bash
cd /var/www/rocky-ai
cp .env.example .env
nano .env
```

必须填写：

```bash
OPENAI_API_KEY=你的模型APIKey
OPENAI_BASE_URL=http://154.64.230.35:3000/v1
OPENAI_TEXT_MODEL=gpt-5.5
OPENAI_IMAGE_API_KEY=你的图片生成APIKey
OPENAI_IMAGE_BASE_URL=http://154.64.230.35:3000/v1
OPENAI_IMAGE_MODEL=gpt-image-2-pro
OPENAI_IMAGE_CONCURRENCY=1
BRIGHTDATA_API_KEY=你的BrightData APIKey
BRIGHTDATA_ZONE=web_unlocker1
BRIGHTDATA_LINK_SCAN_TIMEOUT_MS=20000
SUPABASE_URL=你的Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY=你的Supabase service_role key
SESSION_SECRET=一段长随机字符串
```

## 4. 启动 Node 后端

```bash
cd /var/www/rocky-ai
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

测试：

```bash
curl http://127.0.0.1:8000/api/health
```

看到 `{"ok":true}` 就代表后端在线。

## 5. 配置 Nginx

```bash
sudo cp /var/www/rocky-ai/deploy/vps/nginx-rocky-ai.conf /etc/nginx/sites-available/rocky-ai
sudo ln -sf /etc/nginx/sites-available/rocky-ai /etc/nginx/sites-enabled/rocky-ai
sudo nginx -t
sudo systemctl reload nginx
```

现在可以用 `http://你的服务器IP/` 访问网站。因为前端和 API 同源，页面会直接请求 `/api/generate` 和 `/api/image`，不用再配置 API Base。

## 6. 如果有域名，配置 HTTPS

把域名 A 记录指向 VPS IP，然后执行：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 常用运维命令

```bash
pm2 logs rocky-ai
pm2 restart rocky-ai
pm2 status
curl http://127.0.0.1:8000/api/health
```

## 更新代码

```bash
cd /var/www/rocky-ai
git pull --ff-only
pm2 restart rocky-ai --update-env
```

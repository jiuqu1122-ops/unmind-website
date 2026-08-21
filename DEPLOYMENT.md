# 灵感抽屉官网部署

官网地址：`https://www.unmind.art`

根域名 `https://unmind.art` 会自动跳转到 `https://www.unmind.art`。官网使用独立的静态容器，并通过现有后端项目中的 Caddy 对外提供 HTTPS。

## 一、首次准备 GitHub Deploy Key

官网仓库为私有仓库时，在服务器生成一把只用于官网的只读密钥：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/unmind_website_deploy -C "www.unmind.art deploy" -N ""
cat ~/.ssh/unmind_website_deploy.pub
```

复制输出的整行公钥，在 GitHub 官网仓库中进入：

```text
Settings → Deploy keys → Add deploy key
```

标题填写 `www.unmind.art server`，不要勾选 `Allow write access`。

在服务器配置独立 SSH Host：

```bash
cat >> ~/.ssh/config <<'EOF'

Host github-unmind-website
    HostName github.com
    User git
    IdentityFile ~/.ssh/unmind_website_deploy
    IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
ssh -T git@github-unmind-website
```

看到 GitHub 认证成功提示即可继续。GitHub 提示不提供 Shell 访问是正常现象。

## 二、克隆官网

```bash
git clone git@github-unmind-website:jiuqu1122-ops/unmind-website.git /opt/unmind-website
cd /opt/unmind-website
cp .env.example .env
chmod 600 .env
```

确认网站访问的 API 地址和安装包地址：

```env
NEXT_PUBLIC_DOWNLOAD_URL=
NEXT_PUBLIC_MOBILE_DOWNLOAD_URL=https://inspiration-drawer-prod.oss-cn-hongkong.aliyuncs.com/mobile/Inspiration-Drawer-Mobile-arm64.apk
NEXT_PUBLIC_API_BASE_URL=https://api.unmind.art
```

安装包地址留空时会使用代码中的当前稳定版链接，也可以显式填写直链：

```env
NEXT_PUBLIC_DOWNLOAD_URL=https://download.example.com/InspirationDrawer-Setup.exe
```

这些地址会写入静态构建产物，因此每次修改后需要重新构建官网容器。

灵感空间和网页管理后台依赖后端新接口。上线网站前，先在后端服务器执行数据库迁移，并确保后端 `.env` 包含：

```env
CORS_ALLOWED_ORIGINS=https://www.unmind.art,https://unmind.art
```

然后更新后端：

```bash
cd /opt/inspiration-wallet-server
git pull --ff-only origin main
docker compose build api worker
docker compose run --rm --no-deps api npm run prisma:migrate:deploy
docker compose up -d api worker
```

不要把 `ADMIN_API_KEY` 写进官网 `.env`。管理员在 `/admin` 页面手动输入密钥，密钥只保留在该浏览器页面的内存中。

## 三、启动官网容器

先确认后端 Docker 网络存在：

```bash
docker network inspect inspiration_backend >/dev/null
```

然后构建并启动：

```bash
cd /opt/unmind-website
docker compose up -d --build
docker compose ps
```

官网容器不向公网发布端口，只加入 `inspiration_backend` 内部网络，由 Caddy 访问。

## 四、更新 Caddy

网站容器健康后，更新后端仓库中的 Caddyfile：

```bash
cd /opt/inspiration-wallet-server
git pull --ff-only
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Caddy 会自动为以下域名申请和续期 HTTPS 证书：

```text
unmind.art
www.unmind.art
```

不会改变现有 `api.unmind.art` 后端接口。

## 五、上线验证

```bash
curl -I http://unmind.art
curl -I https://www.unmind.art
curl -sS https://api.unmind.art/health
echo
```

预期：

- `http://unmind.art` 跳转 HTTPS。
- `https://unmind.art` 跳转 `https://www.unmind.art`。
- `https://www.unmind.art` 返回 `200`。
- API 健康检查仍返回 `status: ok`。

浏览器访问：

```text
https://www.unmind.art
https://www.unmind.art/space
https://www.unmind.art/admin
```

验证灵感空间公开接口和跨域响应：

```bash
curl -sS https://api.unmind.art/v1/inspiration-space
curl -I -H 'Origin: https://www.unmind.art' https://api.unmind.art/v1/inspiration-space
```

## 六、以后更新官网

本地修改并推送 GitHub 后，在服务器运行：

```bash
cd /opt/unmind-website
chmod +x scripts/deploy.sh
./scripts/deploy.sh
curl -I https://www.unmind.art
```

查看日志：

```bash
cd /opt/unmind-website
docker compose logs --tail=200 website
```

Caddy 日志：

```bash
cd /opt/inspiration-wallet-server
docker compose logs --tail=200 caddy
```

## 七、回滚官网

官网没有数据库。回滚只需要切换到上一个稳定提交并重新构建：

```bash
cd /opt/unmind-website
git log --oneline -10
git checkout <稳定提交 SHA>
docker compose up -d --build website
```

恢复到主分支：

```bash
git checkout main
git pull --ff-only
docker compose up -d --build website
```

不要运行后端项目的 `docker compose down -v`，避免影响 PostgreSQL 数据卷。

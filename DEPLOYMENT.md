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
WEBSITE_IMAGE=ghcr.io/jiuqu1122-ops/unmind-website:latest
NEXT_PUBLIC_DOWNLOAD_URL=
NEXT_PUBLIC_MACOS_DOWNLOAD_URL=https://inspirationdrawer-1475663212.cos.ap-singapore.myqcloud.com/downloads/macos/preview/Inspiration-Drawer-macOS-Preview.zip
NEXT_PUBLIC_MOBILE_DOWNLOAD_URL=https://api.unmind.art/v1/mobile/apk
NEXT_PUBLIC_API_BASE_URL=https://api.unmind.art
```

安装包地址留空时会使用代码中的当前稳定版链接，也可以显式填写直链：

```env
NEXT_PUBLIC_DOWNLOAD_URL=https://download.example.com/InspirationDrawer-Setup.exe
NEXT_PUBLIC_MACOS_DOWNLOAD_URL=https://download.example.com/Inspiration-Drawer-macOS-Preview.zip
```

`WEBSITE_IMAGE` 是服务器需要拉取的预构建镜像。四个 `NEXT_PUBLIC_*` 地址会写入静态
构建产物，请在 GitHub 仓库的 `Settings → Secrets and variables → Actions → Variables`
中配置；修改后重新运行 `Build website image` 工作流。

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

然后拉取 GitHub Actions 已构建的镜像并启动。不要在 2 GiB 服务器上构建：

```bash
cd /opt/unmind-website
docker compose pull website
docker compose up -d --no-build website
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

本地修改合并到 `main` 后，等待 GitHub Actions 的 `Build website image` 成功，再在
服务器运行：

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

如果 GHCR 镜像为私有包，服务器只需登录一次。创建只有 `read:packages` 权限的 GitHub
Token，然后执行（输入内容不会写入命令历史）：

```bash
read -rsp 'GHCR token: ' GHCR_TOKEN; echo
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u jiuqu1122-ops --password-stdin
unset GHCR_TOKEN
```

## 七、回滚官网

官网没有数据库。GitHub Actions 会同时发布不可变的 `sha-<提交 SHA>` 镜像。回滚时
直接拉取上一稳定提交的镜像，不需要在服务器编译：

```bash
cd /opt/unmind-website
WEBSITE_IMAGE=ghcr.io/jiuqu1122-ops/unmind-website:sha-<稳定提交完整 SHA> docker compose pull website
WEBSITE_IMAGE=ghcr.io/jiuqu1122-ops/unmind-website:sha-<稳定提交完整 SHA> docker compose up -d --no-build website
```

恢复到最新正式镜像：

```bash
git pull --ff-only
docker compose pull website
docker compose up -d --no-build website
```

不要运行后端项目的 `docker compose down -v`，避免影响 PostgreSQL 数据卷。

## 八、教程视频走 COS 直连

首页的原生 `<video>` 直接读取腾讯 COS，不经过官网 Caddy/Nginx 或 API。视频地址在
`app/site-shared.tsx` 的 `tutorialVideoUrl`；`nginx.conf` 将旧地址
`/inspiration-drawer-tutorial.mp4` 以 302 跳转到同一个 COS 对象，兼容旧页面和收藏链接。
`public` 中的原视频保留为源文件，首页不再读取它。

当前对象：

```text
https://inspirationdrawer-1475663212.cos.ap-singapore.myqcloud.com/website/tutorials/be07f0efa479d062/inspiration-drawer-tutorial.mp4
```

- 视频为 1280 × 720、H.264/AAC、282.667 秒、11,367,082 字节；MP4 索引位于文件头，可边下载边播放。
- 只有这个公开教程对象设为 `public-read`，无需签名和后端鉴权；没有修改桶权限或其他对象。
- 对象元数据使用 `Content-Type: video/mp4`、`Cache-Control: public, max-age=31536000, immutable`。
- URL 目录取文件 SHA-256 前 16 位。完整 SHA-256 为 `be07f0efa479d062da7826c90e36d2977bf01f0ac8a60b270e2d8a6b2bf92596`。
- COS 默认域名的 GET 可能强制返回 `Content-Disposition: attachment`；网页使用视频子资源请求，独立链接用于下载。不要添加需要跨域授权的 `crossOrigin` 属性。
- 更新视频时上传到新的内容版本目录，核验公开访问和 Range 响应后，同时更新页面常量及 Nginx 旧地址跳转；不要覆盖已长期缓存的对象。

本次变更推送后，等待 GitHub Actions 的 `Build website image` 成功，再执行：

```bash
cd /opt/unmind-website
bash scripts/deploy.sh
curl --fail --silent --show-error https://www.unmind.art/ | grep -o '<source[^>]*>'
curl -I https://www.unmind.art/inspiration-drawer-tutorial.mp4
curl --fail --silent --show-error --range 0-1023 -D - -o /dev/null \
  https://inspirationdrawer-1475663212.cos.ap-singapore.myqcloud.com/website/tutorials/be07f0efa479d062/inspiration-drawer-tutorial.mp4
```

预期首页视频源指向 COS；旧地址返回 302，`Location` 指向同一对象；COS 返回
`206 Partial Content`、`Content-Range: bytes 0-1023/11367082` 和 `video/mp4`。
本次只需更新官网容器，无需重启 API 或运行数据库迁移。

当前复用的是新加坡 COS，已避开官网服务器带宽；中国大陆用户仍可能受跨境网络影响。
若切换后仍有区域性卡顿，再使用已备案的自定义域名接入国内 CDN，或评估国内 COS 桶。

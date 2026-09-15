# 灵感抽屉官网

`https://www.unmind.art` 的静态官网项目，使用 Next.js 构建并由 Nginx 容器提供服务。

## 页面

- `/`：产品官网与客户端下载
- `/space`：灵感空间，浏览、搜索、下载和投稿节点预设/工作流 JSON
- `/admin`：网页额度管理器，可查询并编辑用户授权、发放积分、查看额度流水、生成兑换码，管理 NewAPI/XAIS/Mikoto/Bigmodel/MiniMax 渠道，测试渠道连接与余额，编辑 Chat Token（含上下文分档、缓存读写）、图片和视频定价，并审核灵感空间投稿

管理员后台使用服务端现有的 `ADMIN_API KEY`，密钥只保存在当前页面内存中，不会写入网站构建产物、本地存储或 Cookie。

## 环境变量

复制 `.env.example` 为 `.env`：

```env
WEBSITE_IMAGE=ghcr.io/jiuqu1122-ops/unmind-website:latest
NEXT_PUBLIC_DOWNLOAD_URL=
NEXT_PUBLIC_MACOS_DOWNLOAD_URL=https://inspirationdrawer-1475663212.cos.ap-singapore.myqcloud.com/downloads/macos/preview/Inspiration-Drawer-macOS-Preview.zip
NEXT_PUBLIC_MOBILE_DOWNLOAD_URL=https://api.unmind.art/v1/mobile/apk
NEXT_PUBLIC_API_BASE_URL=https://api.unmind.art
```

`NEXT_PUBLIC_*` 变量会在静态构建时写入页面，修改后需要重新构建网站。
`WEBSITE_IMAGE` 只用于容器部署；标准部署脚本默认自动选择当前提交对应的不可变镜像。

## 本地开发与验证

```bash
npm install
npm run dev
npm test
npm run build
```

生产环境不会在 2 GiB 服务器上编译。合并到 `main` 后，GitHub Actions 会构建并推送
`ghcr.io/jiuqu1122-ops/unmind-website:latest` 和不可变的 `sha-*` 标签；服务器上的 `scripts/deploy.sh`
会自动拉取与当前 Git 提交完全对应的 `sha-*` 镜像，
只拉取镜像并重启官网容器。四个 `NEXT_PUBLIC_*` 构建参数可在 GitHub 仓库的
`Settings → Secrets and variables → Actions → Variables` 中配置。

灵感空间的投稿会在浏览器内压缩 JSON 内嵌图片和额外展示图，再发送到服务端；所有投稿默认进入待审核状态。

## 联动要求

网站依赖 `inspiration-wallet-server` 的 `/v1/inspiration-space` 与 `/v1/admin` 接口。服务端生产环境必须：

- 执行最新 Prisma migration；
- 正确配置阿里云 OSS；
- 将 `https://www.unmind.art` 和 `https://unmind.art` 加入 `CORS_ALLOWED_ORIGINS`。

完整上线步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

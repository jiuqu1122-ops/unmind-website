# 灵感抽屉官网

`https://www.unmind.art` 的静态官网项目，使用 Next.js 构建并由 Nginx 容器提供服务。

## 页面

- `/`：产品官网与客户端下载
- `/space`：灵感空间，浏览、搜索、下载和投稿节点预设/工作流 JSON
- `/admin`：网页管理员后台，可查询用户、发放积分、生成兑换码并审核灵感空间投稿

管理员后台使用服务端现有的 `ADMIN_API KEY`，密钥只保存在当前页面内存中，不会写入网站构建产物、本地存储或 Cookie。

## 环境变量

复制 `.env.example` 为 `.env`：

```env
NEXT_PUBLIC_DOWNLOAD_URL=
NEXT_PUBLIC_API_BASE_URL=https://api.unmind.art
```

这些变量会在静态构建时写入页面，修改后需要重新构建网站。

## 本地开发与验证

```bash
npm install
npm run dev
npm test
npm run build:static
```

灵感空间的投稿会在浏览器内压缩 JSON 内嵌图片和额外展示图，再发送到服务端；所有投稿默认进入待审核状态。

## 联动要求

网站依赖 `inspiration-wallet-server` 的 `/v1/inspiration-space` 与 `/v1/admin` 接口。服务端生产环境必须：

- 执行最新 Prisma migration；
- 正确配置阿里云 OSS；
- 将 `https://www.unmind.art` 和 `https://unmind.art` 加入 `CORS_ALLOWED_ORIGINS`。

完整上线步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

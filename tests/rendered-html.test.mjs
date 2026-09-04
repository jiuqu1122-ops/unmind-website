import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

async function readRoute(route) {
  return readFile(new URL(`../dist/client/features/${route}/index.html`, import.meta.url), "utf8");
}

async function readTopLevelRoute(route) {
  return readFile(new URL(`../dist/client/${route}/index.html`, import.meta.url), "utf8");
}

test("renders the finished Inspiration Drawer landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-CN"/i);
  assert.match(html, /<title>灵感抽屉｜为灵感留一个位置<\/title>/i);
  assert.match(html, /放进同一张无限画布/);
  assert.match(html, /本地优先/);
  assert.match(html, /创作内容不入库/);
  assert.match(html, /素材集中管理/);
  assert.match(html, /内置工业设计工作流/);
  assert.match(html, /一键完成设计全流程/);
  assert.match(html, /一键模特换装/);
  assert.match(html, /一键详情页生成/);
  assert.match(html, /角色设定套图/);
  assert.match(html, /Windows 版/);
  assert.match(html, /macOS Preview/);
  assert.match(html, /Android 版/);
  assert.match(html, /联系我们/);
  assert.match(html, /微信联系/);
  assert.match(html, /contact-wechat-qr\.png/);
  assert.match(html, /id="tutorial"/);
  assert.match(html, /inspiration-drawer-tutorial\.mp4/);
  assert.match(html, /04:42/);
  assert.match(html, /github\.com\/jiuqu1122-ops\/inspiration-drawer\/releases\/download\/v6\.0\.24\/Inspiration\.Drawer_6\.0\.24_x64-setup\.exe/);
  assert.match(html, /inspirationdrawer-1475663212\.cos\.ap-singapore\.myqcloud\.com\/downloads\/macos\/preview\/Inspiration-Drawer-macOS-Preview\.zip/);
  assert.match(html, /api\.unmind\.art\/v1\/mobile\/apk/);
  assert.doesNotMatch(html, /暂未上线/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("renders the product feature pages", async () => {
  const [materials, notes, pin] = await Promise.all([
    readRoute("materials"),
    readRoute("notes"),
    readRoute("pin"),
  ]);

  assert.match(materials, /把散落的素材/);
  assert.match(materials, /方向盘概念素材/);
  assert.match(notes, /灵感随手记/);
  assert.match(notes, /2026 年 7 月/);
  assert.match(pin, /重要参考/);
  assert.match(pin, /2 个窗口已置顶/);

  for (const html of [materials, notes, pin]) {
    assert.match(html, /github\.com\/jiuqu1122-ops\/inspiration-drawer\/releases\/download\/v6\.0\.24\/Inspiration\.Drawer_6\.0\.24_x64-setup\.exe/);
    assert.match(html, /inspirationdrawer-1475663212\.cos\.ap-singapore\.myqcloud\.com\/downloads\/macos\/preview\/Inspiration-Drawer-macOS-Preview\.zip/);
  }
});

test("renders inspiration space and the web admin console", async () => {
  const [space, admin] = await Promise.all([
    readTopLevelRoute("space"),
    readTopLevelRoute("admin"),
  ]);

  assert.match(space, /灵感空间/);
  assert.match(space, /节点预设、工作流与创作提示词/);
  assert.match(space, /提示词分享/);
  assert.match(space, /上传前自动压缩/);
  assert.match(admin, /管理员后台/);
  assert.match(admin, /管理员密钥/);
});

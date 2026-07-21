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
  assert.match(html, /下载 Windows 版/);
  assert.match(html, /gitee\.com\/zibinyou\/inspiration-drawer\/releases\/download\/v5\.0\.5\/Inspiration\.Drawer_5\.0\.5_x64-setup\.exe/);
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
    assert.match(html, /gitee\.com\/zibinyou\/inspiration-drawer\/releases\/download\/v5\.0\.5\/Inspiration\.Drawer_5\.0\.5_x64-setup\.exe/);
  }
});

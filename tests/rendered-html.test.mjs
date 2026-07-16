import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
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
  assert.match(html, /下载 Windows 版/);
  assert.match(html, /安装包链接待配置/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

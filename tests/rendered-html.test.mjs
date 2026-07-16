import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
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
  assert.match(html, /暂未上线/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

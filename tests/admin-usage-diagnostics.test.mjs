import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'app/admin/admin-usage-diagnostics-model.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('duration formatting distinguishes unknown, zero, milliseconds, seconds and minutes', () => {
  assert.equal(model.formatUsageDuration(null), '—'); assert.equal(model.formatUsageDuration(undefined), '—');
  assert.equal(model.formatUsageDuration(NaN), '—'); assert.equal(model.formatUsageDuration(0), '0 毫秒');
  assert.equal(model.formatUsageDuration(620), '620 毫秒'); assert.equal(model.formatUsageDuration(12800), '12.8 秒');
  assert.equal(model.formatUsageDuration(106200), '1 分 46.2 秒'); assert.equal(model.formatUsageDuration(59999), '1 分');
});
test('a missing selected image model is unknown, never an all-model average', () => {
  const metric = { samples: 2, missingSamples: 0, averageMs: 1000 };
  assert.equal(model.selectedImageTiming({ image: metric, models: [] }, 'all'), metric);
  assert.equal(model.selectedImageTiming({ image: metric, models: [] }, 'missing').averageMs, null);
});
test('partial failures and refunded requests have accurate status labels', () => {
  assert.equal(model.usageErrorStatus({ status: 'SUCCEEDED', failedOutputCount: 1 }), '部分输出失败');
  assert.equal(model.usageErrorStatus({ status: 'REFUNDED', failedOutputCount: 0 }), '已退款');
  assert.match(model.usageErrorStatus({ status: 'PROCESSING', failedOutputCount: 1 }), /处理中/);
});
test('error search and cursor are URL encoded, not concatenated raw', () => {
  const url = model.usageErrorQuery({ days: 7, kind: 'image', query: 'x&limit=999', cursor: 'abc', snapshotAt: '2026-09-22T01:00:00Z' });
  const params = new URL(url, 'https://example.test').searchParams;
  assert.equal(params.get('query'), 'x&limit=999'); assert.equal(params.get('limit'), '25'); assert.equal(params.get('cursor'), 'abc');
});
test('malformed or empty API response is not rendered as zero statistics', () => {
  assert.throws(() => model.requireUsageMetrics({})); assert.throws(() => model.requireUsageErrorPage({}));
  assert.throws(() => model.requireUsageMetrics({ image: { averageMs: -1 }, models: [] }));
});
test('component includes cancellation, version keys, explicit loading/error states, pagination and copy ID', async () => {
  const source = await readFile(path.join(root, 'app/admin/admin-usage-diagnostics.tsx'), 'utf8');
  for (const text of ['controller.abort()', 'controller.signal.aborted', 'metricsResource.key !== metricsKey', 'errorsResource.key !== errorKey', '上一页', '下一页', '未记录详细原因', '复制客户端请求 ID', 'UTC+8']) assert.ok(source.includes(text), text);
  assert.ok(!source.includes('dangerouslySetInnerHTML')); assert.ok(!source.includes('window.alert'));
});

"use client";

import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  formatUsageDuration, selectedImageTiming, usageErrorQuery, usageErrorStatus, usageStageLabel,
  requireUsageMetrics, requireUsageErrorPage,
  type AdminUsageRequest, type UsageErrorPage, type UsageMetrics, type UsageTiming,
} from './admin-usage-diagnostics-model';
import styles from './admin-usage-diagnostics.module.css';

type Resource<T> = { key: string; data: T | null; error: string };
const initialResource = <T,>(): Resource<T> => ({ key: '', data: null, error: '' });
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
const errorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
    return '服务端尚未提供此统计接口，请先更新服务端。';
  }
  return error instanceof Error ? error.message : '数据读取失败，请重试';
};
const sampleLabel = (value: UsageTiming | null) => value
  ? `${value.samples} 个有效样本${value.missingSamples ? ` · ${value.missingSamples} 个时间缺失/异常，已排除` : ''}`
  : '等待统计数据';

export function AdminUsageDiagnostics({ days, imageModel, refreshKey, request }: {
  days: number; imageModel: string; refreshKey: string | undefined; request: AdminUsageRequest;
}) {
  const sectionId = useId();
  const [refresh, setRefresh] = useState(0);
  const [metricsResource, setMetrics] = useState<Resource<UsageMetrics>>(initialResource);
  const [errorsResource, setErrors] = useState<Resource<UsageErrorPage>>(initialResource);
  const [kind, setKind] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [pagination, setPagination] = useState<{ scope: string; cursors: Array<string | null>; snapshot: string | null }>({
    scope: '', cursors: [null], snapshot: null,
  });
  const metricsKey = JSON.stringify([days, refreshKey, refresh]);
  const errorScope = JSON.stringify([days, refreshKey, refresh, kind, search]);
  const pages = pagination.scope === errorScope ? pagination.cursors : [null];
  const cursor = pages[pages.length - 1];
  const snapshotAt = pagination.scope === errorScope ? pagination.snapshot : null;
  const errorKey = JSON.stringify([errorScope, cursor, snapshotAt]);
  const metricsLoading = metricsResource.key !== metricsKey;
  const errorsLoading = errorsResource.key !== errorKey;
  const metrics = metricsLoading ? null : metricsResource.data;
  const errors = errorsLoading ? null : errorsResource.data;
  const imageTiming = selectedImageTiming(metrics, imageModel);

  // Cancellation + a resource key prevent a slow old request from replacing a newer filter.
  useEffect(() => {
    const controller = new AbortController();
    void request<UsageMetrics>(`/v1/admin/usage/metrics?days=${days}`, { signal: controller.signal })
      .then(requireUsageMetrics)
      .then(data => { if (!controller.signal.aborted) setMetrics({ key: metricsKey, data, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setMetrics({ key: metricsKey, data: null, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [days, metricsKey, request]);

  useEffect(() => {
    const controller = new AbortController();
    void request<UsageErrorPage>(usageErrorQuery({ days, kind, query: search, cursor, snapshotAt }), { signal: controller.signal })
      .then(requireUsageErrorPage)
      .then(data => { if (!controller.signal.aborted) setErrors({ key: errorKey, data, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setErrors({ key: errorKey, data: null, error: errorMessage(error) }); });
    return () => controller.abort();
  }, [days, kind, search, cursor, snapshotAt, errorKey, request]);

  const onSearch = (event: FormEvent) => { event.preventDefault(); setSearch(searchInput.trim()); };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice('请求 ID 已复制'); }
    catch { setNotice('复制失败，请在详情中选择请求 ID 手动复制'); }
  };
  const visibleModels = metrics?.models.filter(model => model.modality !== 'image' || imageModel === 'all' || model.key === imageModel) || [];

  return (
    <section className={styles.section} aria-labelledby={`${sectionId}-title`}>
      <header className={styles.header}>
        <div><span>REQUEST HEALTH</span><h3 id={`${sectionId}-title`}>耗时与错误记录</h3><p>沿用上方日期范围，按请求提交日（UTC+8）统计。</p></div>
        <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={metricsLoading || errorsLoading}>刷新记录</button>
      </header>
      <div className={styles.metrics} aria-busy={metricsLoading}>
        <article><span>生图平均耗时</span><strong>{metricsLoading ? '加载中…' : formatUsageDuration(imageTiming?.averageMs)}</strong><small>{imageModel === 'all' ? '全部生图模型' : '上方所选生图模型'} · 每次成功请求</small><small>{sampleLabel(imageTiming)}</small></article>
        <article><span>文字 / 识图平均耗时</span><strong>{metricsLoading ? '加载中…' : formatUsageDuration(metrics?.text.averageMs)}</strong><small>全部文字与识图模型 · 每次成功请求</small><small>{sampleLabel(metrics?.text ?? null)}</small></article>
        <article><span>视频平均耗时</span><strong>{metricsLoading ? '加载中…' : formatUsageDuration(metrics?.video.averageMs)}</strong><small>有任务记录的视频 · 每条成功输出</small><small>{sampleLabel(metrics?.video ?? null)}</small></article>
        <article className={styles.failureMetric}><span>失败 / 异常请求</span><strong>{errorsLoading ? '加载中…' : errors ? errors.total.toLocaleString('zh-CN') : '—'}</strong><small>按下方类型与搜索条件 · 每请求一条</small><small>包含已退款和视频部分输出失败</small></article>
      </div>
      {!metricsLoading && metricsResource.error && <p className={styles.error} role="alert">{metricsResource.error}</p>}
      <p className={styles.note}>耗时为服务端记录的创建至完成时间，包含排队、重试与结果保存，不是渠道纯推理时间。失败、未完成及缺失时间不按 0 秒计入成功平均值；一请求多图仍算一个样本。旧视频只有受理记录时不纳入视频平均耗时。</p>
      <details className={styles.models}>
        <summary>按模型查看平均耗时</summary>
        <div className={styles.tableWrap}><table><caption className={styles.srOnly}>成功请求的模型耗时统计</caption><thead><tr><th>模型</th><th>类型 / 口径</th><th>平均耗时</th><th>有效样本</th><th>时间缺失或异常</th></tr></thead><tbody>
          {visibleModels.map(model => <tr key={`${model.modality}:${model.key}`}><td><strong>{model.displayName}</strong><small>{model.key}</small></td><td>{model.modality === 'image' ? '图片 / 请求' : model.modality === 'video' ? '视频 / 输出任务' : '文字 / 请求'}</td><td>{formatUsageDuration(model.averageMs)}</td><td>{model.samples}</td><td>{model.missingSamples}</td></tr>)}
        </tbody></table>{!metricsLoading && metrics && !visibleModels.length && <p className={styles.empty}>当前范围暂无成功样本</p>}</div>
      </details>
      <div className={styles.errorHeading}><h4>错误记录</h4><small>只展示失败、退款或部分输出失败，不把处理中误判为失败</small></div>
      <form className={styles.filters} onSubmit={onSearch}>
        <label><span>请求类型</span><select value={kind} onChange={event => setKind(event.target.value)}><option value="all">全部类型</option><option value="image">图片</option><option value="text">文字 / 识图</option><option value="video">视频</option></select></label>
        <label className={styles.search}><span>搜索记录</span><input value={searchInput} onChange={event => setSearchInput(event.target.value)} maxLength={128} placeholder="用户、邮箱、模型或请求 ID" /></label>
        <button type="submit">搜索</button>
        {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}>清除搜索</button>}
      </form>
      {!errorsLoading && errorsResource.error && <p className={styles.error} role="alert">{errorsResource.error}</p>}
      <div className={styles.tableWrap} aria-busy={errorsLoading}>
        <table><caption className={styles.srOnly}>请求错误记录</caption><thead><tr><th>提交时间</th><th>用户</th><th>模型 / 关联渠道</th><th>状态</th><th>请求耗时</th><th>原因 / 详情</th></tr></thead><tbody>
          {errors?.items.map(item => <tr key={item.id}>
            <td className={styles.nowrap}>{time(item.createdAt)}</td>
            <td><strong>{item.user.displayName || item.user.email || '未命名用户'}</strong><small>{item.user.email || item.user.id}</small></td>
            <td><strong>{item.modelName}</strong><small>{item.channelName || '渠道未记录'}</small></td>
            <td><span className={styles.badge}>{usageErrorStatus(item)}</span></td>
            <td className={styles.nowrap}>{formatUsageDuration(item.durationMs)}</td>
            <td className={styles.reason}><strong>{item.diagnostic?.message || '未记录详细原因'}</strong><small>{item.diagnostic ? `${usageStageLabel(item.diagnostic.stage)}${item.diagnostic.httpStatus ? ` · HTTP ${item.diagnostic.httpStatus}` : ''}` : '该请求未保存可用的详细原因'}</small>
              <details><summary>查看详情</summary><dl>
                <dt>请求 ID</dt><dd>{item.id}</dd><dt>客户端请求 ID</dt><dd>{item.clientRequestId}</dd>
                <dt>模型标识</dt><dd>{item.modelKey}</dd><dt>关联 Route 上游模型</dt><dd>{item.upstreamModel || '未记录'}</dd>
                <dt>错误码</dt><dd>{item.diagnostic?.code || '未记录'}</dd><dt>底层错误码</dt><dd>{item.diagnostic?.causeCode || '未记录'}</dd>
                <dt>请求清晰度</dt><dd>{item.diagnostic?.resolution || '未记录'}</dd><dt>记录完成时间</dt><dd>{item.completedAt ? time(item.completedAt) : '尚未完成'}</dd>
                {item.failedOutputCount > 0 && <><dt>失败视频输出</dt><dd>{item.failedOutputCount} 条</dd></>}
              </dl><button type="button" onClick={() => void copy(item.clientRequestId)}>复制客户端请求 ID</button></details>
            </td>
          </tr>)}
        </tbody></table>
        {errorsLoading && <p className={styles.empty} role="status">正在读取错误记录…</p>}
        {!errorsLoading && errors && errors.items.length === 0 && <p className={styles.empty}>当前筛选范围没有错误记录</p>}
      </div>
      <footer className={styles.pagination}>
        <span>第 {pages.length} 页 · 每页 25 条{errors ? ` · 共 ${errors.total} 个请求` : ''}</span>
        <div><button type="button" disabled={errorsLoading || pages.length <= 1} onClick={() => setPagination({ scope: errorScope, cursors: pages.slice(0, -1), snapshot: snapshotAt })}>上一页</button>
        <button type="button" disabled={errorsLoading || !errors?.nextCursor} onClick={() => {
          if (errors?.nextCursor) setPagination({ scope: errorScope, cursors: [...pages, errors.nextCursor], snapshot: errors.snapshotAt });
        }}>下一页</button></div>
      </footer>
      <p className={styles.note}>错误记录为管理员只读查询，不触发重新生成或退款。详细错误摘要从本次更新后开始记录；历史及旧协议记录只展示已保存信息；关联渠道来自请求绑定的 Route，不代表完整渠道重试历史。搜索和类型筛选仅作用于错误记录。</p>
      <p className={styles.copyNotice} role="status" aria-live="polite">{notice}</p>
    </section>
  );
}

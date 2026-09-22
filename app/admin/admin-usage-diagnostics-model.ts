export type UsageTiming = { samples: number; missingSamples: number; averageMs: number | null };
export type UsageMetrics = {
  days: number; timeZone: string; generatedAt: string;
  image: UsageTiming; text: UsageTiming; video: UsageTiming;
  models: Array<UsageTiming & { key: string; displayName: string; modality: 'image' | 'text' | 'video' }>;
};
export type UsageErrorItem = {
  id: string; clientRequestId: string; status: string; kind: string;
  modelKey: string; modelName: string; channelName: string | null; upstreamModel: string | null;
  user: { id: string; email: string | null; displayName: string | null };
  createdAt: string; completedAt: string | null; durationMs: number | null; failedOutputCount: number;
  diagnostic: null | {
    version: 1; code: string; message: string; stage: string; httpStatus: number | null;
    causeCode: string | null; recordedAt: string; resolution: string | null;
  };
};
export type UsageErrorPage = { total: number; days: number; snapshotAt: string; nextCursor: string | null; items: UsageErrorItem[] };
export type AdminUsageRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

export function formatUsageDuration(ms?: number | null) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1_000) return `${Math.round(ms)} 毫秒`;
  const tenths = Math.round(ms / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)} 秒`;
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  return seconds ? `${minutes} 分 ${seconds.toFixed(1)} 秒` : `${minutes} 分`;
}

export function selectedImageTiming(metrics: UsageMetrics | null, key: string): UsageTiming | null {
  if (!metrics) return null;
  if (key === 'all') return metrics.image;
  return metrics.models.find(model => model.modality === 'image' && model.key === key)
    ?? { samples: 0, missingSamples: 0, averageMs: null };
}

export function usageErrorStatus(item: Pick<UsageErrorItem, 'status' | 'failedOutputCount'>) {
  if (item.status === 'REFUNDED') return '已退款';
  if (item.status === 'FAILED') return '失败';
  if (item.failedOutputCount > 0) return item.status === 'SUCCEEDED' ? '部分输出失败' : '处理中 · 已有失败输出';
  return item.status;
}

const STAGE_LABELS: Record<string, string> = {
  image_generation: '图片请求', text_request: '文字/识图请求',
  video_task: '视频任务', result_persistence: '结果下载/保存',
};
export const usageStageLabel = (stage?: string) => STAGE_LABELS[stage || ''] || '未记录';

export function usageErrorQuery(input: {
  days: number; kind: string; query: string; cursor?: string | null | undefined; snapshotAt?: string | null | undefined;
}) {
  const params = new URLSearchParams({ days: String(input.days), kind: input.kind, limit: '25' });
  if (input.query.trim()) params.set('query', input.query.trim());
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.snapshotAt) params.set('snapshotAt', input.snapshotAt);
  return `/v1/admin/usage/errors?${params.toString()}`;
}

const objectRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
function validTiming(value: unknown) {
  const item = objectRecord(value);
  return Boolean(item && Number.isSafeInteger(item.samples) && Number(item.samples) >= 0
    && Number.isSafeInteger(item.missingSamples) && Number(item.missingSamples) >= 0
    && (item.averageMs === null || (typeof item.averageMs === 'number' && Number.isFinite(item.averageMs) && item.averageMs >= 0)));
}
export function requireUsageMetrics(value: unknown): UsageMetrics {
  const item = objectRecord(value);
  if (!item || !validTiming(item.image) || !validTiming(item.text) || !validTiming(item.video)
    || !Array.isArray(item.models) || !item.models.every(value => {
      const row = objectRecord(value);
      return row && validTiming(row) && typeof row.key === 'string' && typeof row.displayName === 'string'
        && ['image', 'text', 'video'].includes(String(row.modality));
    })) throw new Error('耗时统计响应格式无效，请刷新或检查服务端版本');
  return value as UsageMetrics;
}
export function requireUsageErrorPage(value: unknown): UsageErrorPage {
  const item = objectRecord(value);
  if (!item || !Number.isSafeInteger(item.total) || Number(item.total) < 0
    || typeof item.snapshotAt !== 'string' || !Number.isFinite(Date.parse(item.snapshotAt))
    || !(item.nextCursor === null || typeof item.nextCursor === 'string') || !Array.isArray(item.items)
    || !item.items.every(value => {
      const row = objectRecord(value);
      const user = objectRecord(row?.user);
      const diag = row?.diagnostic === null ? null : objectRecord(row?.diagnostic);
      return row && user && typeof row.id === 'string' && typeof row.clientRequestId === 'string'
        && typeof row.status === 'string' && typeof row.modelName === 'string'
        && typeof row.modelKey === 'string' && typeof row.createdAt === 'string'
        && typeof user.id === 'string' && (row.diagnostic === null || (diag && typeof diag.message === 'string' && typeof diag.code === 'string'));
    })) throw new Error('错误记录响应格式无效，请刷新或检查服务端版本');
  return value as UsageErrorPage;
}

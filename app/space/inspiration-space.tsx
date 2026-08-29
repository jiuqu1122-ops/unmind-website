"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiBaseUrl } from "../site-shared";
import styles from "./space.module.css";

type ShareKind = "NODE_PRESET" | "WORKFLOW" | "PROMPT";
type SubmitMode = "JSON" | "PROMPT";
type PreviewImage = { dataUrl: string; width: number; height: number };
type InspirationShare = {
  id: string;
  kind: ShareKind;
  title: string;
  description: string | null;
  prompt?: string | null;
  authorName: string;
  tags: string[];
  fileName: string;
  downloadCount: number;
  createdAt: string;
  previews: Array<{ id: string; url: string; width: number; height: number }>;
};

type PreparedJson = {
  fileName: string;
  payload: unknown;
  kind: ShareKind;
  embeddedPreviews: PreviewImage[];
  imageCount: number;
  originalBytes: number;
  compressedBytes: number;
};

const MAX_IMAGE_DIMENSION = 1_600;
const MAX_IMAGE_BYTES = 850 * 1024;
const MAX_EMBEDDED_IMAGES = 30;

const SHARE_KIND_LABELS: Record<ShareKind, string> = {
  NODE_PRESET: "节点预设",
  WORKFLOW: "工作流",
  PROMPT: "提示词",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function classifyJson(value: unknown): ShareKind[] {
  const kinds = new Set<ShareKind>();
  const classify = (candidate: unknown) => {
    if (!isRecord(candidate)) return;
    if (
      candidate.type === "inspiration-drawer-prompt-share"
      && typeof candidate.prompt === "string"
      && candidate.prompt.trim().length > 0
    ) {
      kinds.add("PROMPT");
      return;
    }
    if (typeof candidate.label === "string" && typeof candidate.prompt === "string") kinds.add("NODE_PRESET");
    if (typeof candidate.label === "string" && Array.isArray(candidate.nodes)) kinds.add("WORKFLOW");
  };
  if (Array.isArray(value)) value.forEach(classify);
  else if (isRecord(value)) {
    if (value.type === "inspiration-drawer-workflow-instance" && isRecord(value.workflow)) {
      classify(value.workflow);
    } else {
      if (Array.isArray(value.presets)) value.presets.forEach(classify);
      if (Array.isArray(value.workflows)) value.workflows.forEach(classify);
      if (isRecord(value.preset)) classify(value.preset);
      if (isRecord(value.workflow)) classify(value.workflow);
      if (kinds.size === 0) classify(value);
    }
  }
  return [...kinds];
}

function createPromptPayload(title: string, prompt: string) {
  return {
    type: "inspiration-drawer-prompt-share",
    version: 1,
    title: title.trim(),
    prompt: prompt.trim(),
  };
}

function extractSharedPrompt(value: unknown) {
  if (
    isRecord(value)
    && value.type === "inspiration-drawer-prompt-share"
    && typeof value.prompt === "string"
  ) {
    return value.prompt.trim();
  }
  return "";
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片无法解码"));
    image.src = source;
  });
}

async function compressImage(source: string | Blob): Promise<PreviewImage> {
  const inputUrl = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    const image = await loadImage(inputUrl);
    let width = image.naturalWidth;
    let height = image.naturalHeight;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    for (const dimensionScale of [1, 0.85, 0.7, 0.55]) {
      const outputWidth = Math.max(1, Math.round(width * dimensionScale));
      const outputHeight = Math.max(1, Math.round(height * dimensionScale));
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("浏览器无法创建图片压缩画布");
      context.drawImage(image, 0, 0, outputWidth, outputHeight);

      for (const quality of [0.84, 0.72, 0.6]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (blob && blob.size <= MAX_IMAGE_BYTES) {
          return {
            dataUrl: await blobToDataUrl(blob),
            width: outputWidth,
            height: outputHeight,
          };
        }
      }
    }
    throw new Error("图片压缩后仍超过 850 KB，请换一张较小的展示图");
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(inputUrl);
  }
}

async function compressJsonImages(value: unknown) {
  const cache = new Map<string, PreviewImage>();
  let imageCount = 0;
  const visit = async (current: unknown, depth: number): Promise<unknown> => {
    if (depth > 40) throw new Error("JSON 嵌套层级过深");
    if (typeof current === "string" && /^data:image\/(?:png|jpeg|webp);base64,/i.test(current)) {
      imageCount += 1;
      if (imageCount > MAX_EMBEDDED_IMAGES) {
        throw new Error(`带图 JSON 最多支持 ${MAX_EMBEDDED_IMAGES} 张内嵌图片`);
      }
      const existing = cache.get(current);
      if (existing) return existing.dataUrl;
      const compressed = await compressImage(current);
      cache.set(current, compressed);
      return compressed.dataUrl;
    }
    if (Array.isArray(current)) {
      const next = [];
      for (const item of current) next.push(await visit(item, depth + 1));
      return next;
    }
    if (isRecord(current)) {
      const next: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(current)) next[key] = await visit(item, depth + 1);
      return next;
    }
    return current;
  };
  return {
    payload: await visit(value, 0),
    previews: [...cache.values()].slice(0, 6),
    imageCount,
  };
}

async function parseApi<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(payload.message || `请求失败（HTTP ${response.status}）`);
  return payload as T;
}

export function InspirationSpace() {
  const [items, setItems] = useState<InspirationShare[]>([]);
  const [previewIndexes, setPreviewIndexes] = useState<Record<string, number>>({});
  const [kindFilter, setKindFilter] = useState<"" | ShareKind>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitMode, setSubmitMode] = useState<SubmitMode>("JSON");
  const [prepared, setPrepared] = useState<PreparedJson | null>(null);
  const [promptText, setPromptText] = useState("");
  const [extraPreviews, setExtraPreviews] = useState<PreviewImage[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const promptPreviewRequired = submitMode === "PROMPT" || prepared?.kind === "PROMPT";
  const visibleSubmissionPreviews = [
    ...(promptPreviewRequired ? extraPreviews.slice(0, 1) : extraPreviews),
    ...(promptPreviewRequired ? [] : prepared?.embeddedPreviews || []),
  ].slice(0, 6);

  const loadItems = useCallback(async (nextKind: "" | ShareKind = "", nextQuery = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "48" });
      if (nextKind) params.set("kind", nextKind);
      if (nextQuery.trim()) params.set("query", nextQuery.trim());
      const response = await fetch(`${apiBaseUrl}/v1/inspiration-space?${params}`);
      const data = await parseApi<{ items: InspirationShare[] }>(response);
      setItems(data.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "灵感空间加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems("", ""), 0);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  const totalDownloads = useMemo(
    () => items.reduce((sum, item) => sum + item.downloadCount, 0),
    [items],
  );

  const movePreview = (shareId: string, previewCount: number, offset: number) => {
    setPreviewIndexes((current) => {
      const activeIndex = current[shareId] ?? 0;
      return {
        ...current,
        [shareId]: (activeIndex + offset + previewCount) % previewCount,
      };
    });
  };

  const recordDownload = (shareId: string) => {
    setItems((current) => current.map((item) => (
      item.id === shareId
        ? { ...item, downloadCount: item.downloadCount + 1 }
        : item
    )));
  };

  const copyPrompt = async (item: InspirationShare) => {
    setError("");
    setNotice("");
    try {
      let prompt = item.prompt?.trim() || "";
      if (!prompt) {
        const response = await fetch(`${apiBaseUrl}/v1/inspiration-space/${item.id}/download`);
        const payload = await parseApi<unknown>(response);
        prompt = extractSharedPrompt(payload);
        if (!prompt) throw new Error("这个分享里没有可复制的提示词内容");
        recordDownload(item.id);
      }
      await navigator.clipboard.writeText(prompt);
      setNotice(`已复制「${item.title}」的提示词`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提示词复制失败");
    }
  };

  const selectJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress("正在读取并检查 JSON…");
    try {
      const text = await file.text();
      const originalBytes = new Blob([text]).size;
      if (originalBytes > 20 * 1024 * 1024) throw new Error("原始 JSON 不能超过 20 MB");
      const raw = JSON.parse(text) as unknown;
      const kinds = classifyJson(raw);
      if (!kinds.length) throw new Error("没有识别到灵感抽屉节点预设、工作流或提示词分享");
      setProgress("正在自动压缩 JSON 内嵌图片…");
      const compressed = await compressJsonImages(raw);
      const compressedText = JSON.stringify(compressed.payload);
      const compressedBytes = new Blob([compressedText]).size;
      if (compressedBytes > 8 * 1024 * 1024) throw new Error("压缩后的 JSON 仍超过 8 MB");
      const kind: ShareKind = kinds.includes("WORKFLOW")
        ? "WORKFLOW"
        : kinds.includes("NODE_PRESET") ? "NODE_PRESET" : "PROMPT";
      setPrepared({
        fileName: file.name,
        payload: compressed.payload,
        kind,
        embeddedPreviews: compressed.previews,
        imageCount: compressed.imageCount,
        originalBytes,
        compressedBytes,
      });
      setTitle(file.name.replace(/\.json$/i, "").slice(0, 80));
      setNotice(compressed.imageCount
        ? `已识别并压缩 ${compressed.imageCount} 张内嵌图片`
        : "JSON 已识别，可继续添加展示图");
    } catch (reason) {
      setPrepared(null);
      setError(reason instanceof Error ? reason.message : "JSON 处理失败");
    } finally {
      setProgress("");
      setBusy(false);
    }
  };

  const selectPreviews = async (event: ChangeEvent<HTMLInputElement>) => {
    const maxFiles = promptPreviewRequired ? 1 : 6;
    const files = [...(event.target.files || [])].slice(0, maxFiles);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    setProgress("正在压缩展示图…");
    try {
      const compressed: PreviewImage[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        compressed.push(await compressImage(file));
      }
      setExtraPreviews(compressed);
      setNotice(`已压缩 ${compressed.length} 张展示图`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "展示图压缩失败");
    } finally {
      setProgress("");
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const isDirectPromptSubmission = submitMode === "PROMPT";
    if (!isDirectPromptSubmission && !prepared) {
      setError("请先选择 JSON 文件");
      return;
    }
    if (title.trim().length < 2 || authorName.trim().length < 2) {
      setError("标题和分享者名称至少填写 2 个字符");
      return;
    }
    if (isDirectPromptSubmission && promptText.trim().length < 10) {
      setError("提示词内容至少填写 10 个字符");
      return;
    }
    const kind: ShareKind = isDirectPromptSubmission ? "PROMPT" : prepared!.kind;
    const requiresGeneratedPreview = kind === "PROMPT";
    if (requiresGeneratedPreview && extraPreviews.length === 0) {
      setError("提示词分享必须上传 1 张由该提示词生成的效果图");
      return;
    }
    const previews = [
      ...(requiresGeneratedPreview ? extraPreviews.slice(0, 1) : extraPreviews),
      ...(requiresGeneratedPreview ? [] : prepared?.embeddedPreviews || []),
    ].slice(0, 6);
    const payload = isDirectPromptSubmission
      ? createPromptPayload(title, promptText)
      : prepared!.payload;
    const fileName = isDirectPromptSubmission
      ? `${title.trim().replace(/\.json$/i, "") || "提示词分享"}.json`
      : prepared!.fileName;
    setBusy(true);
    setError("");
    setProgress("正在提交审核…");
    try {
      const response = await fetch(`${apiBaseUrl}/v1/inspiration-space`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          description: description.trim() || null,
          authorName: authorName.trim(),
          tags: [...new Set(tags.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 8),
          fileName,
          payload,
          previews,
        }),
      });
      const result = await parseApi<{ message: string }>(response);
      setNotice(result.message);
      setPrepared(null);
      setPromptText("");
      setExtraPreviews([]);
      setTitle("");
      setDescription("");
      setTags("");
      setShowSubmit(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "投稿失败");
    } finally {
      setProgress("");
      setBusy(false);
    }
  };

  return (
    <>
      <section className={styles.hero}>
        <div>
          <span>INSPIRATION SPACE</span>
          <h1>把好用的预设，<br /><em>分享给更多创作者。</em></h1>
          <p>浏览和分享灵感抽屉节点预设、工作流与创作提示词。带图 JSON 会在上传前自动压缩，提示词可以直接复制使用。</p>
          <div className={styles.heroActions}>
            <button onClick={() => setShowSubmit(true)}>＋ 分享灵感</button>
            <small>投稿审核后公开 · 支持 JSON、提示词与生成效果图</small>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <article><span>WORKFLOW</span><strong>产品主视觉生成</strong><i>3 张参考图</i></article>
          <article><span>NODE PRESET</span><strong>CMF 质感增强</strong><i>拖入画布即可使用</i></article>
          <article><span>PROMPT</span><strong>角色一致性提示词</strong><i>一键复制开始创作</i></article>
        </div>
      </section>

      <section className={styles.library}>
        <header>
          <div><span>COMMUNITY LIBRARY</span><h2>最新分享</h2><p>{items.length} 个公开资源 · 累计下载 {totalDownloads} 次</p></div>
          <form onSubmit={(event) => { event.preventDefault(); void loadItems(kindFilter, query); }}>
            <select value={kindFilter} onChange={(event) => { const value = event.target.value as "" | ShareKind; setKindFilter(value); void loadItems(value, query); }}>
              <option value="">全部类型</option>
              <option value="WORKFLOW">工作流</option>
              <option value="NODE_PRESET">节点预设</option>
              <option value="PROMPT">提示词分享</option>
            </select>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、作者或标签" />
            <button>搜索</button>
          </form>
        </header>

        {(error || notice) && <div className={error ? styles.error : styles.notice}>{error || notice}</div>}

        <div className={styles.grid}>
          {items.map((item) => {
            const previewCount = item.previews.length;
            const previewIndex = previewCount
              ? Math.min(previewIndexes[item.id] ?? 0, previewCount - 1)
              : 0;
            const activePreview = item.previews[previewIndex];
            return (
              <article key={item.id} className={styles.card}>
                <div className={styles.cover}>
                  {activePreview
                    ? (
                        <img
                          key={activePreview.id}
                          src={activePreview.url}
                          alt={`${item.title} 预览 ${previewIndex + 1}`}
                          loading="lazy"
                        />
                      )
                    : <div className={styles.emptyCover}><span>JSON</span><small>暂无展示图</small></div>}
                  <em>{SHARE_KIND_LABELS[item.kind]}</em>
                  {previewCount > 1 && (
                    <>
                      <b className={styles.previewCount}>{previewIndex + 1} / {previewCount}</b>
                      <button
                        type="button"
                        className={`${styles.previewArrow} ${styles.previewPrevious}`}
                        aria-label={`查看 ${item.title} 的上一张图片`}
                        onClick={() => movePreview(item.id, previewCount, -1)}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className={`${styles.previewArrow} ${styles.previewNext}`}
                        aria-label={`查看 ${item.title} 的下一张图片`}
                        onClick={() => movePreview(item.id, previewCount, 1)}
                      >
                        ›
                      </button>
                      <div className={styles.previewDots} aria-label={`${item.title} 图片选择`}>
                        {item.previews.map((preview, index) => (
                          <button
                            key={preview.id}
                            type="button"
                            className={index === previewIndex ? styles.activeDot : ""}
                            aria-label={`查看第 ${index + 1} 张图片`}
                            aria-current={index === previewIndex ? "true" : undefined}
                            onClick={() => setPreviewIndexes((current) => ({
                              ...current,
                              [item.id]: index,
                            }))}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <small>{item.authorName} · {new Date(item.createdAt).toLocaleDateString("zh-CN")}</small>
                  <h3>{item.title}</h3>
                  {item.kind === "PROMPT" && item.prompt ? (
                    <div className={styles.promptPreview}>
                      <span>实际提示词</span>
                      <p>{item.prompt}</p>
                    </div>
                  ) : (
                    <p>{item.description || "作者没有填写额外说明。"}</p>
                  )}
                  <div className={styles.tags}>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  <div className={styles.cardActions}>
                    {item.kind === "PROMPT" && (
                      <button
                        type="button"
                        className={styles.copyPromptButton}
                        onClick={() => void copyPrompt(item)}
                      >
                        复制提示词
                      </button>
                    )}
                    {item.kind !== "PROMPT" && (
                      <a
                        className={styles.downloadLink}
                        href={`${apiBaseUrl}/v1/inspiration-space/${item.id}/download`}
                        onClick={() => recordDownload(item.id)}
                      >
                        下载 JSON
                        <span className={styles.downloadBadge} title={`已下载 ${item.downloadCount} 次`}>
                          {item.downloadCount}
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {!loading && !items.length && <div className={styles.empty}>暂时没有符合条件的分享，成为第一个分享者吧。</div>}
          {loading && <div className={styles.empty}>正在加载灵感空间…</div>}
        </div>
      </section>

      {showSubmit && (
        <div className={styles.modalBackdrop} onMouseDown={() => !busy && setShowSubmit(false)}>
          <form className={styles.modal} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>SHARE TO COMMUNITY</span><h2>分享你的创作灵感</h2></div><button type="button" onClick={() => !busy && setShowSubmit(false)}>×</button></header>
            <div className={styles.submitModes} aria-label="分享类型">
              <button type="button" className={submitMode === "JSON" ? styles.activeMode : ""} onClick={() => setSubmitMode("JSON")}>预设 / 工作流</button>
              <button type="button" className={submitMode === "PROMPT" ? styles.activeMode : ""} onClick={() => setSubmitMode("PROMPT")}>提示词分享</button>
            </div>
            {submitMode === "JSON" ? (
              <label className={styles.fileDrop}>
                <input type="file" accept=".json,application/json" onChange={selectJson} disabled={busy} />
                <strong>{prepared ? prepared.fileName : "选择灵感抽屉 JSON 文件"}</strong>
                <small>{prepared
                  ? `${SHARE_KIND_LABELS[prepared.kind]} · ${prepared.imageCount} 张内嵌图 · ${(prepared.compressedBytes / 1024).toFixed(0)} KB`
                  : "支持节点预设、工作流模板、带图工作流实例与提示词 JSON"}</small>
              </label>
            ) : (
              <label className={styles.promptEditor}>
                <strong>提示词内容</strong>
                <textarea
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  maxLength={20_000}
                  rows={8}
                  placeholder="粘贴完整提示词，保留必要的格式、变量和使用说明…"
                />
                <small>{promptText.length.toLocaleString("zh-CN")} / 20,000 字符</small>
              </label>
            )}
            <div className={styles.formGrid}>
              <label><strong>标题</strong><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></label>
              <label><strong>分享者名称</strong><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} maxLength={32} /></label>
            </div>
            <label><strong>简介</strong><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} placeholder="说明这份分享适合做什么、如何使用" /></label>
            <label><strong>标签</strong><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="工业设计, CMF, 产品展示（最多 8 个）" /></label>
            <label className={styles.previewPicker}>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple={!promptPreviewRequired} onChange={selectPreviews} disabled={busy} />
              <span>
                <strong>{promptPreviewRequired ? "上传提示词生成效果图（必填）" : "添加展示图"}</strong>
                <small>{promptPreviewRequired
                  ? "必须上传 1 张由这段提示词生成的图片，系统会自动压缩为 WebP。"
                  : "最多 6 张，自动压缩为 WebP；没有时会使用 JSON 内嵌图片。"}</small>
              </span>
            </label>
            {visibleSubmissionPreviews.length > 0 && (
              <div className={styles.previewStrip}>
                {visibleSubmissionPreviews.map((preview, index) => <img key={`${preview.dataUrl.slice(-20)}-${index}`} src={preview.dataUrl} alt="" />)}
              </div>
            )}
            {(error || notice || progress) && <div className={error ? styles.error : styles.notice}>{error || progress || notice}</div>}
            <footer><small>所有投稿默认进入待审核，不会立即公开。</small><button disabled={busy || (submitMode === "JSON" ? !prepared || promptPreviewRequired && extraPreviews.length === 0 : promptText.trim().length < 10 || extraPreviews.length === 0)}>{busy ? progress || "处理中…" : "提交审核"}</button></footer>
          </form>
        </div>
      )}
    </>
  );
}

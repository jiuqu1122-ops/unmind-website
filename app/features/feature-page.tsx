import Link from "next/link";
import { DownloadButton, LogoMark, SiteFooter, SiteHeader } from "../site-shared";

export type FeatureKind = "materials" | "notes" | "pin";

const content = {
  materials: {
    active: "materials" as const,
    eyebrow: "MATERIAL LIBRARY",
    title: <>把散落的素材，<em>收进一套清晰的秩序。</em></>,
    intro: "图片、视频、文本、文件与网页参考统一归档。用文件夹、类型筛选和画布入口，让每一份素材都能快速找到，也能随时回到创作现场。",
    points: [
      ["多类型统一收纳", "图片、视频、文本和项目文件在同一处浏览。"],
      ["文件夹与画布联动", "从素材库直接进入画布，保持上下文连续。"],
      ["本地索引更安心", "原始素材留在设备中，不建立云端副本。"],
    ],
  },
  notes: {
    active: "notes" as const,
    eyebrow: "NOTES & SCHEDULE",
    title: <>灵感随手记，<em>待办按时发生。</em></>,
    intro: "把临时想法、截图和待办收进便签，再放进日历安排推进节奏。内容与项目素材互相连接，不需要在多个工具之间来回切换。",
    points: [
      ["便签随手收集", "文字、图片和项目线索随时放入便签栏。"],
      ["日历统一安排", "待办、提醒与创作节点在月历中清楚可见。"],
      ["今天聚焦执行", "当天事项独立汇总，减少遗漏和上下文切换。"],
    ],
  },
  pin: {
    active: "pin" as const,
    eyebrow: "ALWAYS ON TOP",
    title: <>重要参考，<em>始终留在视线里。</em></>,
    intro: "截取屏幕任意区域并置顶，边建模、写代码或做方案，边查看关键细节。参考图不再被窗口遮住，也无需反复切换应用。",
    points: [
      ["区域截图即刻置顶", "框选需要的内容，一步变成桌面悬浮参考。"],
      ["轻量缩放与透明度", "按工作空间调整尺寸，不挡住正在编辑的内容。"],
      ["完成后收入素材库", "置顶参考可以继续归档，进入项目或画布。"],
    ],
  },
};

function MaterialsVisual() {
  const assets = ["form", "wheel", "surface", "layout", "light", "detail"];
  return (
    <div className="effect-window materials-effect">
      <div className="effect-topbar">
        <div><LogoMark small /><strong>素材管理</strong><i /></div>
        <div className="effect-actions"><span>▦ 全部类型</span><span>⌕</span><span>＋</span></div>
      </div>
      <div className="materials-body">
        <aside className="effect-sidebar">
          <button type="button">＋ 新建文件夹</button>
          <small>素材库</small>
          <div className="effect-folder active"><i>▱</i><strong>全部素材</strong><em>318</em></div>
          <div className="effect-folder"><i>▱</i><span>AI 生图</span><em>248</em></div>
          <div className="effect-folder"><i>▱</i><span>品牌 Logo</span><em>22</em></div>
          <div className="effect-folder"><i>▱</i><span>草图与提案</span><em>7</em></div>
          <small>画布</small>
          <div className="effect-folder canvas-active"><i>▧</i><strong>产品方向盘</strong></div>
          <div className="effect-folder"><i>▧</i><span>默认画布</span></div>
        </aside>
        <div className="asset-browser">
          <div className="asset-tabs"><span className="active">全部</span><span>图片</span><span>文本</span><span>视频</span><span>文件</span></div>
          <div className="asset-heading"><div><small>PRODUCT REFERENCES</small><strong>方向盘概念素材</strong></div><span>24 项素材</span></div>
          <div className="asset-grid">
            {assets.map((asset, index) => (
              <article className="effect-asset" key={asset}>
                <div className={`asset-art art-${asset}`}><i /><i /><i /></div>
                <small>{index < 3 ? "参考图像" : "设计素材"}</small>
                <strong>{["结构比例研究", "操控区参考", "材质与纹理", "布局草图", "灯光氛围", "细节语言"][index]}</strong>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div className="effect-float material-float"><span>✓</span><strong>已整理 318 份素材</strong></div>
    </div>
  );
}

function NotesVisual() {
  const days = ["30", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "1", "2", "3"];
  return (
    <div className="effect-window notes-effect">
      <div className="effect-topbar">
        <div><LogoMark small /><strong>便签与日程</strong><i /></div>
        <div className="effect-actions"><span>今天</span><span>⌕</span><span>＋</span></div>
      </div>
      <div className="notes-body">
        <aside className="notes-rail">
          <div className="notes-switch"><span>快捷</span><strong>便签 <i>3</i></strong></div>
          <button type="button">＋ 新增便签</button>
          <article className="note-list active"><i>✓</i><div><strong>近期项目待办</strong><small>3 项任务 · 今天</small></div></article>
          <article className="note-list"><i>▧</i><div><strong>界面动效想法</strong><small>画布缩放与吸附</small></div></article>
          <article className="note-list"><i>●</i><div><strong>灵感记录</strong><small>材质与光影方向</small></div></article>
          <div className="mini-sticky"><small>今日重点</small><strong>完成方向盘提案整理</strong><span>14:30</span></div>
        </aside>
        <div className="calendar-panel">
          <div className="calendar-heading"><div><small>CALENDAR</small><strong>2026 年 7 月</strong></div><div><span>‹</span><span>今天</span><span>›</span></div></div>
          <div className="week-row"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
          <div className="calendar-grid">
            {days.map((day, index) => <span key={`${day}-${index}`} className={day === "21" && index > 15 ? "today" : index === 4 ? "has-event" : ""}>{day}{index === 4 && <i>方案确认</i>}{day === "21" && index > 15 && <b>今</b>}</span>)}
          </div>
          <div className="today-row"><span>09:30</span><strong>整理参考素材与项目节点</strong><i>进行中</i></div>
        </div>
      </div>
      <div className="effect-float notes-float"><span>3</span><strong>今天还有 3 项计划</strong></div>
    </div>
  );
}

function PinVisual() {
  return (
    <div className="effect-window pin-effect">
      <div className="desktop-menu"><div><LogoMark small /><strong>截图置顶</strong></div><span>工作区 01</span><i>•••</i></div>
      <div className="desktop-code"><span /><span /><span /><span /><span /><span /><span /></div>
      <div className="pinned-window main-pin">
        <div className="pin-toolbar"><span><i>●</i> 产品结构参考</span><div><b title="调整透明度">◐</b><b title="缩放">⌕</b><b title="复制">▣</b><b className="active" title="取消置顶">⌖</b></div></div>
        <div className="pin-canvas">
          <div className="pin-product"><i /><i /><i /><i /></div>
          <div className="pin-measures"><span>128</span><span>42°</span><span>96</span></div>
        </div>
        <div className="pin-caption"><small>结构比例</small><strong>握持区与按键布局参考</strong></div>
      </div>
      <div className="pinned-window small-pin">
        <div className="pin-toolbar"><span><i>●</i> 细节放大</span><div><b className="active">⌖</b></div></div>
        <div className="detail-rings"><i /><i /><i /></div>
      </div>
      <div className="pin-note"><span>REFERENCE 02</span><strong>保留中心轮廓，缩短两侧握把。</strong><small>置顶便签 · 不遮挡编辑区</small></div>
      <div className="pin-status"><i>⌖</i><span><strong>2 个窗口已置顶</strong><small>保持在其他应用上方</small></span></div>
    </div>
  );
}

function FeatureVisual({ kind }: { kind: FeatureKind }) {
  if (kind === "materials") return <MaterialsVisual />;
  if (kind === "notes") return <NotesVisual />;
  return <PinVisual />;
}

export function FeaturePage({ kind }: { kind: FeatureKind }) {
  const page = content[kind];
  return (
    <main id="top" className={`feature-page feature-page-${kind}`}>
      <SiteHeader active={page.active} />
      <section className="feature-hero" aria-labelledby="feature-title">
        <div className="feature-hero-copy">
          <div className="eyebrow"><span /> {page.eyebrow}</div>
          <h1 id="feature-title">{page.title}</h1>
          <p>{page.intro}</p>
          <div className="feature-hero-actions"><a className="text-action" href="#details">查看功能细节 <span>↓</span></a><Link href="/#download">选择下载版本 <span>→</span></Link></div>
        </div>
        <div className="feature-effect-stage" aria-label={`${page.eyebrow} 产品界面效果图`}>
          <div className="feature-effect-glow" />
          <FeatureVisual kind={kind} />
        </div>
      </section>

      <section className="feature-details" id="details" aria-labelledby="details-title">
        <div className="feature-details-heading"><span>BUILT FOR FLOW</span><h2 id="details-title">少一点切换，<br />多一点连续创作。</h2></div>
        <div className="feature-points">
          {page.points.map(([title, description], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <section className="feature-switch" aria-label="更多功能">
        <div><span>EXPLORE MORE</span><h2>继续探索灵感抽屉</h2></div>
        <div className="feature-switch-links">
          {kind !== "materials" && <a href="/features/materials"><i>▦</i><span><strong>素材管理</strong><small>统一整理创作内容</small></span><b>→</b></a>}
          {kind !== "notes" && <a href="/features/notes"><i>▤</i><span><strong>便签与日程</strong><small>记录并安排每个想法</small></span><b>→</b></a>}
          {kind !== "pin" && <a href="/features/pin"><i>⌖</i><span><strong>截图置顶</strong><small>让重要参考保持可见</small></span><b>→</b></a>}
        </div>
      </section>

      <section className="feature-download-band">
        <div><LogoMark /><span><small>INSPIRATION DRAWER</small><strong>把创作过程留在自己的设备上。</strong></span></div>
        <div className="feature-download-actions"><DownloadButton compact /><DownloadButton compact platform="macos" /></div>
      </section>
      <SiteFooter />
    </main>
  );
}

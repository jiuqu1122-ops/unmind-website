import Link from "next/link";

export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.unmind.art"
).replace(/\/+$/, "");

export const downloadUrl =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL
  || "https://github.com/jiuqu1122-ops/inspiration-drawer/releases/download/v6.0.24/Inspiration.Drawer_6.0.24_x64-setup.exe";

export const macosDownloadUrl =
  process.env.NEXT_PUBLIC_MACOS_DOWNLOAD_URL
  || "https://inspirationdrawer-1475663212.cos.ap-singapore.myqcloud.com/downloads/macos/preview/Inspiration-Drawer-macOS-Preview.zip";

export const mobileDownloadUrl =
  process.env.NEXT_PUBLIC_MOBILE_DOWNLOAD_URL
  || `${apiBaseUrl}/v1/mobile/apk`;

export function LogoMark({ small = false }: { small?: boolean }) {
  return <span className={small ? "logo-mark small" : "logo-mark"} aria-hidden="true" />;
}

type DownloadPlatform = "windows" | "macos" | "android";

const platformDownloads: Record<DownloadPlatform, { url: string; mark: string; label: string; detail: string; aria: string }> = {
  windows: {
    url: downloadUrl,
    mark: "⊞",
    label: "Windows 版",
    detail: "Windows 10 / 11",
    aria: "下载灵感抽屉 Windows 安装包",
  },
  macos: {
    url: macosDownloadUrl,
    mark: "⌘",
    label: "macOS Preview",
    detail: "Apple 芯片 · macOS 12+",
    aria: "下载灵感抽屉 macOS Apple Silicon Preview 压缩包",
  },
  android: {
    url: mobileDownloadUrl,
    mark: "A",
    label: "Android 版",
    detail: "手机与平板 · Android 7+",
    aria: "下载灵感抽屉 Android 移动端 APK",
  },
};

export function DownloadButton({ compact = false, platform = "windows" }: { compact?: boolean; platform?: DownloadPlatform }) {
  const download = platformDownloads[platform];
  const className = ["download-button", `platform-${platform}`, compact ? "compact" : ""].filter(Boolean).join(" ");

  return (
    <a className={className} href={download.url} download aria-label={download.aria}>
      <span className="download-mark" aria-hidden="true">{download.mark}</span>
      <span className="download-button-copy">
        <strong>{download.label}</strong>
        {!compact && <small>{download.detail}</small>}
      </span>
      <span className="download-arrow" aria-hidden="true">↘</span>
    </a>
  );
}

export function MobileDownloadButton({ compact = false }: { compact?: boolean }) {
  return <DownloadButton compact={compact} platform="android" />;
}

type SiteSection = "home" | "tutorial" | "materials" | "notes" | "pin" | "space" | "admin";

const navigation = [
  { id: "home", href: "/", label: "首页" },
  { id: "tutorial", href: "/#tutorial", label: "使用教程" },
  { id: "materials", href: "/features/materials", label: "素材管理" },
  { id: "notes", href: "/features/notes", label: "便签日程" },
  { id: "pin", href: "/features/pin", label: "截图置顶" },
  { id: "space", href: "/space", label: "灵感空间" },
] as const;

export function SiteHeader({ active = "home" }: { active?: SiteSection }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="灵感抽屉首页">
        <LogoMark />
        <span><strong>灵感抽屉</strong><small>INSPIRATION DRAWER</small></span>
      </Link>
      <nav aria-label="主导航">
        {navigation.map((item) => (
          <Link key={item.id} href={item.href} className={active === item.id ? "current" : undefined} aria-current={active === item.id ? "page" : undefined}>{item.label}</Link>
        ))}
        <Link href="/#contact">联系我们</Link>
        <Link href="/#download">立即下载</Link>
      </nav>
      <details className="mobile-menu">
        <summary aria-label="打开导航" title="打开导航">☰</summary>
        <div>
          {navigation.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}
          <Link href="/#contact">联系我们</Link>
          <Link href="/#download">立即下载</Link>
        </div>
      </details>
    </header>
  );
}

export function SiteFooter() {
  return (
    <>
      <section className="contact-section" id="contact" aria-labelledby="contact-title">
        <div className="contact-copy">
          <span>CONTACT · WECHAT</span>
          <h2 id="contact-title">有问题，直接聊聊。</h2>
          <p>产品使用、商务合作或售后支持，欢迎使用微信扫码联系。</p>
          <small>工作时间内会尽快回复。</small>
        </div>
        <a
          className="contact-qr-card"
          href="/contact-wechat-qr.png"
          target="_blank"
          rel="noreferrer"
          aria-label="查看微信联系方式二维码原图"
        >
          {/* Keep the QR asset pixel-exact instead of routing it through image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/contact-wechat-qr.png" alt="微信联系方式二维码" width="654" height="645" />
          <span><strong>微信联系</strong><small>扫码添加 · 点击查看原图</small></span>
        </a>
      </section>
      <footer>
        <Link className="footer-brand" href="/"><LogoMark small /><strong>灵感抽屉</strong></Link>
        <p>本地优先的无限画布创作工具。</p>
        <span>© {new Date().getFullYear()} UNMIND.ART · <Link href="/admin">管理入口</Link></span>
      </footer>
    </>
  );
}

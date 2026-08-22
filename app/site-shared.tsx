import Link from "next/link";

export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.unmind.art"
).replace(/\/+$/, "");

export const downloadUrl =
  process.env.NEXT_PUBLIC_DOWNLOAD_URL
  || "https://gitee.com/zibinyou/inspiration-drawer/releases/download/v6.0.4/Inspiration.Drawer_6.0.4_x64-setup.exe";

export const mobileDownloadUrl =
  process.env.NEXT_PUBLIC_MOBILE_DOWNLOAD_URL
  || `${apiBaseUrl}/v1/mobile/apk`;

export function LogoMark({ small = false }: { small?: boolean }) {
  return <span className={small ? "logo-mark small" : "logo-mark"} aria-hidden="true" />;
}

export function DownloadButton({ compact = false }: { compact?: boolean }) {
  const className = compact ? "download-button compact" : "download-button";

  return (
    <a className={className} href={downloadUrl} download aria-label="下载灵感抽屉 Windows 安装包">
      <span className="download-mark" aria-hidden="true">↓</span>
      <span>下载 Windows 版</span>
      {!compact && <small>点击立即下载安装包</small>}
    </a>
  );
}

export function MobileDownloadButton({ compact = false }: { compact?: boolean }) {
  const className = compact ? "download-button compact mobile-download-button" : "download-button mobile-download-button";

  return (
    <a className={className} href={mobileDownloadUrl} download aria-label="下载灵感抽屉 Android 移动端 APK">
      <span className="download-mark" aria-hidden="true">↓</span>
      <span>下载 Android 版</span>
      {!compact && <small>适用于 Android 手机和平板</small>}
    </a>
  );
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

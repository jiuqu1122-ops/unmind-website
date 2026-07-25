import Link from "next/link";

export const downloadUrl =
  "https://gitee.com/zibinyou/inspiration-drawer/releases/download/v5.0.8/Inspiration.Drawer_5.0.8_x64-setup.exe";

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

type SiteSection = "home" | "materials" | "notes" | "pin";

const navigation = [
  { id: "home", href: "/", label: "首页" },
  { id: "materials", href: "/features/materials", label: "素材管理" },
  { id: "notes", href: "/features/notes", label: "便签日程" },
  { id: "pin", href: "/features/pin", label: "截图置顶" },
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
        <Link href="/#download">立即下载</Link>
      </nav>
      <details className="mobile-menu">
        <summary aria-label="打开导航" title="打开导航">☰</summary>
        <div>
          {navigation.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}
          <Link href="/#download">立即下载</Link>
        </div>
      </details>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <Link className="footer-brand" href="/"><LogoMark small /><strong>灵感抽屉</strong></Link>
      <p>本地优先的无限画布创作工具。</p>
      <span>© {new Date().getFullYear()} UNMIND.ART</span>
    </footer>
  );
}

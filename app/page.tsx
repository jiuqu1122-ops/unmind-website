import { DownloadButton, LogoMark, SiteFooter, SiteHeader } from "./site-shared";

export default function Home() {
  return (
    <main id="top">
      <SiteHeader />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span /> 本地优先的创作工作空间</div>
          <h1 id="hero-title">把素材、思路与创作，<em>放进同一张无限画布。</em></h1>
          <p>灵感抽屉在你的电脑上整理图片、视频、笔记与 AI 生成内容。项目与素材留在本地，方便管理，也让创作过程更私密。</p>
          <div className="privacy-pills" aria-label="产品特性">
            <span><i>✓</i> 本地存储</span><span><i>✓</i> 云端不留存创作内容</span><span><i>✓</i> 工业设计全流程</span>
          </div>
          <div className="hero-actions"><DownloadButton /><span className="system-note">适用于 Windows 10 / 11 · 64 位</span></div>
        </div>

        <div className="product-scene" aria-label="灵感抽屉无限画布界面示意">
          <div className="scene-glow" />
          <div className="workspace-window">
            <div className="workspace-topbar">
              <div className="workspace-title"><LogoMark small /><strong>无限画布</strong><i /></div>
              <div className="topbar-actions"><span>保存快照</span><span>适应画布</span><b>×</b></div>
            </div>
            <div className="workspace-body">
              <aside className="workspace-sidebar">
                <div className="sidebar-primary"><LogoMark small /><strong>无限画布</strong><em>10</em></div>
                <button type="button">＋ 新建文件夹</button>
                <div className="folder-row"><i>▱</i><strong>全部素材</strong><em>315</em></div>
                <div className="folder-row child active"><i>▱</i><strong>AI 生图</strong><em>245</em></div>
                <div className="folder-row child"><i>▱</i><span>品牌 Logo</span><em>22</em></div>
                <div className="folder-row child"><i>▱</i><span>草图与提案</span><em>7</em></div>
                <div className="sidebar-divider" />
                <div className="folder-row canvas-row selected"><i>▱</i><strong>默认画布</strong></div>
                <div className="folder-row canvas-row"><i>▱</i><span>灵感农场</span></div>
              </aside>

              <div className="infinite-canvas">
                <div className="connector c1" /><div className="connector c2" /><div className="connector c3" /><div className="connector c4" /><div className="connector c5" /><div className="connector c6" /><div className="connector c7" />

                <div className="canvas-node image-node node-a"><div className="node-image blue-one"><i /><i /><i /></div><small>参考素材</small><strong>产品结构草图</strong></div>
                <div className="canvas-node note-node node-b"><small>灵感笔记</small><strong>探索更轻盈的视觉语言</strong><p>保留结构特征，增加留白和呼吸感。</p></div>
                <div className="canvas-node image-node node-c"><div className="node-image dark-one"><i /><i /></div><small>AI 图像</small><strong>方向 01 · 科技蓝</strong></div>
                <div className="canvas-node image-node node-d"><div className="node-image dark-two"><i /><i /></div><small>AI 图像</small><strong>方向 02 · 极简白</strong></div>
                <div className="canvas-node gallery-node node-e"><div><i /><i /><i /><i /></div><small>灵感集合</small><strong>材质与光影参考</strong></div>
                <div className="canvas-node text-node node-f"><span>✦</span><div><small>AI 整理</small><strong>已生成 3 个设计方向</strong></div></div>
                <div className="canvas-node image-node node-g"><div className="node-image blue-two"><i /><i /></div><small>最终方案</small><strong>视觉方案确认</strong></div>
                <div className="canvas-node mini-node node-h"><i /><span>视频分镜</span></div>
                <div className="canvas-node mini-node node-i"><i /><span>文案提纲</span></div>

                <div className="canvas-tools"><span className="active">◎</span><span>▧</span><span>▤</span><span>↻</span><span>⌁</span><span>➤</span><span>T</span><span>✦</span></div>
                <div className="canvas-status"><i>▧</i> 已整理 59</div>
              </div>
            </div>
          </div>
          <div className="floating-tag tag-top">素材与节点自由连接</div>
          <div className="floating-tag tag-bottom"><span>●</span> 本地项目空间</div>
        </div>
      </section>

      <section className="intro" id="product" aria-labelledby="product-title">
        <div className="section-heading"><span>ONE LOCAL SPACE, EVERY IDEA</span><h2 id="product-title">素材不再散落，创作自然连贯</h2><p>从收集参考到组织节点，再到 AI 辅助生成，把完整创作过程留在一张可以持续生长的画布里。</p></div>
        <div className="feature-grid">
          <article><div className="feature-number">01</div><div className="feature-icon">⌂</div><h3>本地优先</h3><p>画布、笔记与素材索引默认保存在你的设备上。无需把整个项目上传到云端，也能随时继续工作。</p></article>
          <article className="featured" id="privacy"><div className="feature-number">02</div><div className="feature-icon">◇</div><h3>创作内容不入库</h3><p>服务器只处理必要的账户、授权与额度信息，不保存你的画布、素材原文件和创作正文。</p><small>使用第三方 AI 时，请求内容仍受所选服务商规则约束。</small></article>
          <article><div className="feature-number">03</div><div className="feature-icon">▦</div><h3>素材集中管理</h3><p>图片、视频、草图、文案和生成结果统一归档。用文件夹、画布节点与连线建立自己的素材体系。</p></article>
        </div>
      </section>

      <section className="capabilities-section" aria-labelledby="capabilities-title">
        <div className="capabilities-heading"><span>MORE THAN A CANVAS</span><h2 id="capabilities-title">从收集到执行，<br />每一步都在同一个工作空间。</h2><p>灵感抽屉把高频创作工具放进统一的本地工作区。需要深入了解时，每项能力都有独立的功能介绍。</p></div>
        <div className="capability-grid">
          <a href="/features/materials"><div className="capability-preview material-mini"><i /><i /><i /><span>318</span></div><small>01 · MATERIALS</small><h3>素材管理</h3><p>统一整理图片、视频、文本与项目文件，让素材和画布保持连接。</p><strong>了解素材管理 <span>→</span></strong></a>
          <a href="/features/notes"><div className="capability-preview notes-mini"><i /><i /><i /><span>21</span></div><small>02 · NOTES & SCHEDULE</small><h3>便签与日程</h3><p>随手记录灵感，安排待办与提醒，把今天需要推进的事情放在眼前。</p><strong>了解便签日程 <span>→</span></strong></a>
          <a href="/features/pin"><div className="capability-preview pin-mini"><i /><i /><i /><span>⌖</span></div><small>03 · ALWAYS ON TOP</small><h3>截图置顶</h3><p>截取关键区域并保持置顶，边创作边查看参考，不再反复切换窗口。</p><strong>了解截图置顶 <span>→</span></strong></a>
        </div>
      </section>

      <section className="workflow-section" aria-labelledby="workflow-title">
        <div className="workflow-heading">
          <div><span>INDUSTRIAL DESIGN WORKFLOW</span><h2 id="workflow-title">内置工业设计工作流，<br />一键完成设计全流程。</h2></div>
          <p>从模糊需求到可交付方案，Agent 会按工业设计方法组织每个阶段，把参考素材、分析结果和生成内容自动连接到画布。</p>
        </div>
        <div className="workflow-track">
          <article><span>01</span><i>⌕</i><h3>需求拆解</h3><p>明确用户、场景与设计目标</p></article>
          <b>→</b>
          <article><span>02</span><i>◎</i><h3>调研洞察</h3><p>整理竞品、趋势与机会点</p></article>
          <b>→</b>
          <article><span>03</span><i>✦</i><h3>概念生成</h3><p>快速探索多组造型方向</p></article>
          <b>→</b>
          <article><span>04</span><i>◇</i><h3>方案深化</h3><p>完善结构、CMF 与细节</p></article>
          <b>→</b>
          <article><span>05</span><i>✓</i><h3>交付整理</h3><p>汇总设计过程与最终成果</p></article>
        </div>
        <div className="workflow-action"><span><i>✦</i><strong>启动工业设计工作流</strong></span><small>自动创建阶段节点 · 保留完整设计脉络</small></div>
      </section>

      <section className="privacy-band" aria-label="隐私说明">
        <div className="privacy-visual"><span className="privacy-core">本地</span><i className="ring r1" /><i className="ring r2" /><b className="orbit-dot d1" /><b className="orbit-dot d2" /></div>
        <div><span>LOCAL-FIRST BY DESIGN</span><h2>你的创作，首先属于你的设备。</h2><p>灵感抽屉把云端能力和本地工作区分开：账户与额度由服务端管理，真实的画布项目和素材内容由你自己保管。</p><ul><li>不上传整份画布项目</li><li>不在服务器建立素材库副本</li><li>不使用创作内容做站内广告画像</li></ul></div>
      </section>

      <section className="download-section" id="download" aria-labelledby="download-title">
        <div className="download-spotlight" />
        <div className="download-copy"><LogoMark /><span>YOUR IDEAS, YOUR SPACE</span><h2 id="download-title">给每一份素材，一个能彼此连接的位置。</h2><p>下载灵感抽屉，在本地建立属于你的创作资料库与无限画布。</p><DownloadButton compact /></div>
      </section>

      <SiteFooter />
    </main>
  );
}

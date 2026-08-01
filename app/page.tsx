import { DownloadButton, LogoMark, SiteFooter, SiteHeader } from "./site-shared";

export default function Home() {
  return (
    <main id="top">
      <SiteHeader />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow">LOCAL-FIRST CREATIVE WORKSPACE</div>
          <h1 id="hero-title">把素材、思路与创作，<em>放进同一张无限画布。</em></h1>
          <p>灵感抽屉在你的电脑上整理图片、视频、笔记与 AI 生成内容。项目与素材留在本地，方便管理，也让创作过程更私密。</p>
          <div className="privacy-pills" aria-label="产品特性">
            <span><i>✓</i> 本地存储</span><span><i>✓</i> 云端不留存创作内容</span><span><i>✓</i> 工业设计全流程</span>
          </div>
          <div className="hero-actions"><DownloadButton /><span className="system-note">适用于 Windows 10 / 11 · 64 位</span></div>
        </div>

        <div className="product-scene" aria-label="灵感抽屉工作台操作演示">
          <div className="scene-frame">
            <div className="scene-frame-head">
              <span><i /> 灵感抽屉工作台</span>
              <small>真实产品演示</small>
            </div>
            <video className="hero-product-video" autoPlay muted loop playsInline preload="metadata">
              <source src="/inspiration-drawer-tutorial.mp4" type="video/mp4" />
            </video>
            <div className="scene-caption">
              <strong>素材、节点与创作流程，在同一个空间里展开。</strong>
              <span>4 分钟快速上手</span>
            </div>
          </div>
          <div className="scene-note scene-note-top"><span>LOCAL-FIRST</span><strong>你的素材，留在自己的设备上。</strong></div>
          <div className="scene-note scene-note-bottom"><i /> 无限画布工作区</div>
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

      <section className="tutorial-section" id="tutorial" aria-labelledby="tutorial-title">
        <div className="tutorial-copy">
          <span>GET STARTED IN MINUTES</span>
          <h2 id="tutorial-title">4 分钟快速了解灵感抽屉。</h2>
          <p id="tutorial-description">跟随完整操作演示，了解素材整理、无限画布与创作流程的基本用法。视频可以暂停、拖动进度或全屏观看。</p>
          <div className="tutorial-meta" aria-label="教程信息">
            <span>04:42</span>
            <span>720P</span>
            <span>操作教程</span>
          </div>
        </div>
        <div className="tutorial-player-shell">
          <div className="tutorial-player-bar"><span><i /> 灵感抽屉 · 快速上手</span><small>04:42</small></div>
          <video className="tutorial-video" controls playsInline preload="metadata" aria-describedby="tutorial-description">
            <source src="/inspiration-drawer-tutorial.mp4" type="video/mp4" />
            您的浏览器不支持视频播放，可<a href="/inspiration-drawer-tutorial.mp4">下载教程视频</a>查看。
          </video>
        </div>
      </section>

      <section className="workflow-library-section" aria-labelledby="workflow-library-title">
        <div className="workflow-library-heading">
          <div>
            <span>READY-TO-USE AI WORKFLOWS</span>
            <h2 id="workflow-library-title">不止工业设计，<br />高频出图任务也能一键完成。</h2>
          </div>
          <div>
            <p>把重复的提示词、参考图和节点连接保存成工作流。选择模板、替换素材，然后让画布自动完成整套生成过程。</p>
            <a href="/space">浏览灵感空间 <span>→</span></a>
          </div>
        </div>

        <div className="workflow-showcase-grid">
          <a className="workflow-showcase-card" href="/space">
            <div className="workflow-card-visual outfit-visual" aria-hidden="true">
              <div className="outfit-person before"><i /><b /><span>原始服装</span></div>
              <em>→</em>
              <div className="outfit-person after"><i /><b /><span>目标穿搭</span></div>
              <small>人物与背景保持一致</small>
            </div>
            <div className="workflow-card-copy">
              <small>ECOMMERCE · FASHION</small>
              <h3>一键模特换装</h3>
              <p>上传服装图并替换工作流图片槽位，保持模特、姿势和背景一致，快速生成不同款式的上身效果。</p>
              <div><span>固定人物</span><span>服装替换</span><span>批量出图</span></div>
              <strong>查看换装工作流 <span>→</span></strong>
            </div>
          </a>

          <a className="workflow-showcase-card" href="/space">
            <div className="workflow-card-visual detail-visual" aria-hidden="true">
              <div className="detail-main"><i /><b /></div>
              <div className="detail-side"><i /><i /><i /></div>
              <span>主图</span><span>卖点</span><span>细节</span>
              <small>一次生成完整商品套图</small>
            </div>
            <div className="workflow-card-copy">
              <small>ECOMMERCE · PRODUCT PAGE</small>
              <h3>一键详情页生成</h3>
              <p>从商品主图出发，自动生成卖点场景、材质细节和多角度展示，快速组成统一风格的详情页素材。</p>
              <div><span>主图套图</span><span>场景生成</span><span>风格统一</span></div>
              <strong>查看详情页工作流 <span>→</span></strong>
            </div>
          </a>

          <a className="workflow-showcase-card compact" href="/space">
            <div className="workflow-card-visual character-visual" aria-hidden="true">
              <i /><i /><i /><i /><span>正面</span><span>侧面</span><span>表情</span><span>动作</span>
            </div>
            <div className="workflow-card-copy">
              <small>CHARACTER · CONSISTENCY</small>
              <h3>角色设定套图</h3>
              <p>围绕同一角色生成多视角、表情和动作参考，适合短剧、动画与 IP 设定。</p>
              <strong>查看角色工作流 <span>→</span></strong>
            </div>
          </a>

          <a className="workflow-showcase-card compact" href="/space">
            <div className="workflow-card-visual product-visual" aria-hidden="true">
              <i /><b /><i /><b /><i /><span>线稿</span><span>效果图</span><span>场景图</span>
            </div>
            <div className="workflow-card-copy">
              <small>INDUSTRIAL DESIGN · VISUALIZATION</small>
              <h3>产品设计套图</h3>
              <p>从线稿快速扩展到产品效果图、多视角和场景展示，保留完整的方案演进过程。</p>
              <strong>查看产品工作流 <span>→</span></strong>
            </div>
          </a>
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

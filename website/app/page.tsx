"use client";

import Image from "next/image";
import ProductDemo from "./ProductDemo";
import SideRays from "./SideRays";

const DOWNLOAD_URL = "https://github.com/xiaopu-ai/TO-DO-Panel/releases/latest";
const GITHUB_URL = "https://github.com/xiaopu-ai/TO-DO-Panel";

const capabilities = [
  { number: "01", label: "首页工作台", title: "一次展开，接住所有临时动作。", body: "当前窗口、快速录音、随笔记、常用指令与番茄钟，被收进同一块本地 Bento 工作台。", accent: "lime" },
  { number: "02", label: "待办", title: "今天该做什么，一眼就知道。", body: "四个可改名工作区、截止时间和本机提醒，让优先级不再只停在脑子里。", accent: "orange" },
  { number: "03", label: "链接", title: "刚看到的好东西，不再消失。", body: "粘贴公开链接后回车保存，网页标题、站点图标与分组在后台安静补齐。", accent: "blue" },
  { number: "04", label: "录制", title: "灵感先说下来，稍后再整理。", body: "主动点击才启动麦克风，音频保存在本地；配置后可选实时转写。", accent: "red" },
  { number: "05", label: "笔记", title: "随手写下，也能随时找回。", body: "首页速记一键归档到独立笔记页，可搜索、重命名和继续编辑。", accent: "violet" },
] as const;

const faqs = [
  { question: "哪些 Mac 可以使用？", answer: "当前版本面向 macOS 14 或更高版本、Apple Silicon Mac，并为带刘海的 MacBook 做了优化。暂不提供 Intel、Windows 或 Linux 版本。" },
  { question: "待办、链接和录音会上传吗？", answer: "默认不会。待办、随笔记、链接和录音元数据由本地工作区与 LocalStorage 保存，录音文件保存在当前 Mac。只有你主动配置转写服务后，对应内容才会按配置发送。" },
  { question: "摄像头和麦克风会常驻吗？", answer: "不会。镜子和录音都需要你主动点击才会启动。离开首页、结束录音或收起面板时，对应轨道会立即释放。" },
  { question: "Codex / GPT 完成提醒如何工作？", answer: "配置本机 Hook 后，任务完成会在顶部显示一条不抢焦点的通知。接口只监听 127.0.0.1，不会暴露到局域网或公网。" },
  { question: "为什么首次打开会看到系统提示？", answer: "当前安装包采用 ad-hoc 签名，尚未完成 Apple 公证。首次打开时可能需要前往「系统设置 → 隐私与安全性」选择「仍要打开」。" },
] as const;

function ArrowIcon() { return <span aria-hidden="true">↗</span>; }

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <div className="nav-shell">
          <a className="brand-lockup" href="#top" aria-label="TO-DO Panel 首页"><Image src="/notchtodo-logo.png" alt="" width={34} height={34} priority /><span>TO-DO Panel</span></a>
          <nav className="nav-links" aria-label="主要导航"><a href="#experience">产品演示</a><a href="#features">功能</a><a href="#privacy">隐私</a><a href="#faq">常见问题</a></nav>
          <div className="nav-actions"><a className="nav-github" href={GITHUB_URL}>GitHub</a><a className="nav-download" href={DOWNLOAD_URL}>下载 <ArrowIcon /></a></div>
        </div>
      </header>

      <main id="main-content">
        <section className="hero-section" id="top">
          <div className="hero-rays" aria-hidden="true"><SideRays speed={0.72} rayColor1="#d7ffdf" rayColor2="#98a9ff" intensity={1.56} spread={1.8} origin="top-right" tilt={-8} saturation={0.55} blend={0.58} falloff={1.82} opacity={0.52} /></div>
          <div className="hero-shell">
            <div className="hero-copy">
              <div className="hero-kicker"><span className="status-light" /><span className="shiny-text">macOS 本地工作台</span></div>
              <h1>把 Mac 刘海，<br /><span>变成随手可用的工作台。</span></h1>
              <p>待办、笔记、链接、录音和当前窗口，都收在屏幕顶端。需要时展开，用完即收起。</p>
              <div className="hero-actions"><a className="button button-primary" href={DOWNLOAD_URL}>下载 macOS 版 <span aria-hidden="true">↓</span></a><a className="button button-secondary" href={GITHUB_URL}>查看源码 <ArrowIcon /></a></div>
              <div className="hero-meta" aria-label="产品信息"><span>macOS 14+</span><span>Apple Silicon</span><span>本机优先</span><span>MIT 开源</span></div>
            </div>
            <div className="hero-object" aria-label="TO-DO Panel 应用图标">
              <div className="hero-orbit hero-orbit-outer" /><div className="hero-orbit hero-orbit-inner" /><div className="hero-logo-glow" />
              <Image src="/notchtodo-logo.png" alt="TO-DO Panel 银色应用图标" width={560} height={560} priority />
              <div className="hero-float-card hero-float-top"><kbd>SPACE</kbd><span>随时唤出</span></div>
              <div className="hero-float-card hero-float-bottom"><span className="status-light" /><div><strong>正在待命</strong><small>不抢焦点</small></div></div>
            </div>
          </div>
          <div className="hero-scroll-cue"><span />向下看它如何工作</div>
        </section>

        <section className="trust-strip" aria-label="产品原则"><div className="section-shell"><span>LOCAL FIRST</span><i /><span>ZERO CLOUD ACCOUNT</span><i /><span>NATIVE MACOS POSITIONING</span><i /><span>OPEN SOURCE</span></div></section>

        <section className="experience-section section-shell" id="experience">
          <div className="section-heading"><div><span className="section-index">01 / 交互演示</span><h2>需要时展开，<br />其余时间保持安静。</h2></div><p>演示会从折叠刘海开始，自动展开并走过五个页面。点击任意 Tab，它会立即停下并把控制权交给你。</p></div>
          <div className="demo-wrap"><ProductDemo /></div>
        </section>

        <section className="features-section section-shell" id="features">
          <div className="section-heading compact-heading"><div><span className="section-index">02 / 五个页面</span><h2>少开几个窗口，<br />也少丢几次思路。</h2></div></div>
          <div className="capability-grid">{capabilities.map((item, index) => (
            <article className={`capability-card capability-${item.accent}${index === 0 ? " capability-featured" : ""}`} key={item.number}>
              <header><span>{item.number}</span><i /></header><div className="capability-visual" aria-hidden="true"><span /><span /><span /></div><p className="capability-label">{item.label}</p><h3>{item.title}</h3><p>{item.body}</p>
            </article>
          ))}</div>
        </section>

        <section className="ai-section section-shell">
          <div className="ai-copy"><span className="section-index">03 / 本机 AI 提醒</span><h2>AI 做完了，<br />不用一直盯着。</h2><p>接入 Codex 或 GPT 的本机完成事件后，TO-DO Panel 会在屏幕顶部给你一条不抢焦点的提醒。</p><span className="loopback-note"><span className="status-light" />只监听 127.0.0.1</span></div>
          <div className="notification-stage" aria-label="Codex 任务完成通知演示"><div className="notification-notch" /><div className="notification-card"><div className="notification-icon">C</div><div><span>CODEX · 刚刚</span><strong>官网交互已完成</strong><p>灵动岛 · 点击返回项目窗口</p></div><i /></div></div>
        </section>

        <section className="privacy-section" id="privacy"><div className="privacy-shell section-shell">
          <div className="privacy-copy"><span className="section-index">04 / 本机优先</span><h2>你的工作内容，<br />不需要离开这台 Mac。</h2><p>TO-DO Panel 没有强制账号、没有云同步，也不读取 Screen Time 私有数据。</p></div>
          <div className="privacy-flow"><div className="privacy-node privacy-source"><span>你的输入</span><small>待办 · 链接 · 录音</small></div><div className="privacy-line"><i /><i /><i /></div><div className="privacy-node privacy-device"><Image src="/favicon.png" alt="" width={34} height={34} /><span>当前 Mac</span><small>本地工作区</small></div><div className="privacy-blocked"><span>× 强制云账号</span><span>× 行为追踪</span><span>× 公网通知端口</span></div></div>
        </div></section>

        <section className="download-section section-shell"><div className="download-card"><div><span className="section-index">下载前确认</span><h2>为 Apple Silicon Mac 准备。</h2><p>当前版本仍处于公开测试阶段，安装前请先阅读 GitHub 中的安装说明。</p></div><div className="download-specs"><p><span>系统</span><strong>macOS 14+</strong></p><p><span>芯片</span><strong>Apple Silicon</strong></p><p><span>授权</span><strong>MIT 开源</strong></p><p><span>签名</span><strong>Ad-hoc</strong></p></div><a className="button button-primary" href={DOWNLOAD_URL}>前往 GitHub Releases <ArrowIcon /></a></div></section>

        <section className="faq-section section-shell" id="faq"><div className="section-heading compact-heading"><div><span className="section-index">05 / FAQ</span><h2>下载之前，<br />你可能想知道。</h2></div></div><div className="faq-list">{faqs.map((faq, index) => <details key={faq.question}><summary><span>{String(index + 1).padStart(2, "0")}</span>{faq.question}<i aria-hidden="true">＋</i></summary><p>{faq.answer}</p></details>)}</div></section>

        <section className="final-cta section-shell"><div className="final-cta-inner"><Image src="/notchtodo-logo.png" alt="" width={142} height={142} /><span className="hero-kicker"><span className="status-light" />TO-DO Panel</span><h2>让屏幕顶部，<br />成为离工作最近的地方。</h2><div className="hero-actions"><a className="button button-primary" href={DOWNLOAD_URL}>下载 macOS 版 <span aria-hidden="true">↓</span></a><a className="button button-secondary" href={GITHUB_URL}>在 GitHub 查看 <ArrowIcon /></a></div></div></section>
      </main>

      <footer className="site-footer"><div className="footer-shell"><div className="brand-lockup"><Image src="/favicon.png" alt="" width={28} height={28} /><span>TO-DO Panel</span></div><p>把高频小动作，留在 Mac 刘海下面。</p><div><a href={GITHUB_URL}>GitHub</a><a href={`${GITHUB_URL}/issues`}>反馈问题</a><a href={`${GITHUB_URL}#license`}>MIT License</a></div></div></footer>
    </>
  );
}

export default function PrivacySection() {
  return (
    <section className="privacy-section" data-section="privacy" id="privacy">
      <div><span className="section-kicker">LOCAL FIRST</span><h2>STAYS ON<br />YOUR MAC</h2><p>没有强制账号，也没有云同步。只有你主动配置转写服务后，对应音频才会按配置发送。</p></div>
      <div className="privacy-flow" aria-label="数据保存在当前 Mac">
        <div><strong>你的输入</strong><span>待办 · 笔记 · 录音</span></div><i aria-hidden="true">→</i><div><strong>当前 Mac</strong><span>LocalStorage · Files · safeStorage</span></div>
        <p><span>× 强制云账号</span><span>× 公网通知端口</span><span>× 行为追踪</span></p>
      </div>
    </section>
  );
}


"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function ProductStory() {
  const reducedMotion = useReducedMotion();
  return (
    <section className="story-section" data-section="story" id="about">
      <span className="story-object story-object-moon" aria-hidden="true" />
      <span className="story-object story-object-loop" aria-hidden="true" />
      <motion.div className="story-copy" initial={reducedMotion ? false : { opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.45 }} transition={{ duration: 0.8 }}>
        <span className="section-kicker">WHY TO-DO PANEL</span>
        <h2>ONE PLACE</h2>
        <p>不用频繁切换应用，也不用让临时想法消失。待办、笔记、链接、录音和本机 AI 提醒，都留在屏幕顶部。</p>
      </motion.div>
    </section>
  );
}


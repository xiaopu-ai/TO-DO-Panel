"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type PointerEvent } from "react";
import RealProductMedia from "./RealProductMedia";
import { DOWNLOAD_URL, GITHUB_URL, NAV_ITEMS } from "./landingContent";
import { getMagnetTransform } from "./landingMotion.mjs";

const RESTING_TRANSFORM = { x: 0, y: 0, rotateX: 0, rotateY: 0 };

export default function HeroSection() {
  const reducedMotion = useReducedMotion();
  const [panelTransform, setPanelTransform] = useState(RESTING_TRANSFORM);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPanelTransform(getMagnetTransform(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      { width: bounds.width, height: bounds.height },
      reducedMotion === true,
    ));
  };

  return (
    <section className="hero-section" data-section="hero" id="top">
      <motion.nav className="hero-nav" initial={reducedMotion ? false : { opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} aria-label="主要导航">
        <a className="brand-lockup" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="" width="34" height="34" />
          <span>TO-DO PANEL</span>
        </a>
        <div className="hero-nav-links">{NAV_ITEMS.map(([label, href]) => <a href={href} key={label}>{label}</a>)}</div>
      </motion.nav>

      <motion.h1 className="hero-wordmark" initial={reducedMotion ? false : { opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.12 }}>TO-DO PANEL</motion.h1>

      <div className="hero-stage">
        <motion.div className="hero-copy" initial={reducedMotion ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.72, delay: 0.3 }}>
          <span className="section-kicker">MACOS LOCAL WORKSPACE</span>
          <h2><span>把 Mac 刘海，</span><span>变成随手可用的工作台。</span></h2>
          <div className="hero-actions">
            <a className="landing-cta landing-cta-primary" href={DOWNLOAD_URL} data-primary-action>下载 macOS 版本</a>
            <a className="landing-cta landing-cta-secondary" href={GITHUB_URL} data-secondary-action>查看 GitHub 仓库</a>
          </div>
        </motion.div>

        <div className="hero-panel-hit" onPointerMove={handlePointerMove} onPointerLeave={() => setPanelTransform(RESTING_TRANSFORM)}>
          <motion.div className="hero-panel-float" animate={panelTransform} transition={{ type: "spring", stiffness: 170, damping: 22, mass: 0.7 }}>
            <RealProductMedia src="/product-captures/home.png" alt="TO-DO Panel 真实首页面板" className="hero-product-capture" />
          </motion.div>
        </div>
      </div>
      <span className="hero-orbit hero-orbit-left" aria-hidden="true" />
      <span className="hero-orbit hero-orbit-right" aria-hidden="true" />
    </section>
  );
}

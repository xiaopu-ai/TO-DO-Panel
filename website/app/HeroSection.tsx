"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { DOWNLOAD_URL, GITHUB_URL, NAV_ITEMS } from "./landingContent";
import {
  INITIAL_HERO_PANEL_STATE,
  nextHeroPanelState,
  type HeroPanelState,
} from "./landingHero.mjs";

const HERO_ENTRANCE_MS = 1700;

export default function HeroSection() {
  const reducedMotion = useReducedMotion();
  const [panelState, setPanelState] = useState<HeroPanelState>(INITIAL_HERO_PANEL_STATE);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const expanded = panelState === "expanded";

  useEffect(() => {
    const timer = window.setTimeout(() => setEntranceComplete(true), reducedMotion ? 0 : HERO_ENTRANCE_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const togglePanel = () => {
    setPanelState((current) => nextHeroPanelState(current, entranceComplete));
  };

  const noMotion = reducedMotion === true;

  return (
    <section className={`hero-section hero-photographic${entranceComplete ? " is-ready" : ""}`} data-section="hero" id="top">
      <motion.div
        className="hero-scene-artboard hero-scene-base"
        initial={noMotion ? false : { opacity: 0, scale: 1.025 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero/mac-scene.png" alt="" />
      </motion.div>

      <motion.h1
        className="hero-wordmark"
        initial={noMotion ? false : { opacity: 0, y: 38 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        TO-DO PANEL
      </motion.h1>

      <motion.div
        className="hero-scene-artboard hero-screen-layer"
        initial={noMotion ? false : { opacity: 0, scale: 1.025 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-screen-wallpaper" src="/hero/mac-wallpaper.png" alt="Mac 屏幕默认壁纸" />
          <motion.div
            className="hero-panel-reveal"
            initial={noMotion ? false : { opacity: 0, clipPath: "inset(0 0 100% 0 round 18px)" }}
            animate={{ opacity: 1, clipPath: "inset(0 0 0% 0 round 18px)" }}
            transition={{ duration: 0.65, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`hero-panel-toggle is-${panelState}`}
            >
              {/* Product UI is shown only through real screenshots from the running app. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="hero-panel-image hero-panel-image-expanded" src="/product-captures/home.png" alt="TO-DO Panel 真实首页展开态" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="hero-panel-image hero-panel-image-collapsed" src="/hero/panel-collapsed.png" alt="TO-DO Panel 真实折叠态" />
              <button
                className="hero-panel-trigger"
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? "折叠 TO-DO Panel" : "展开 TO-DO Panel"}
                aria-disabled={!entranceComplete}
                onClick={togglePanel}
              />
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="hero-scene-artboard hero-scene-foreground"
        initial={noMotion ? false : { opacity: 0, scale: 1.025 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        {/* Reuses original photo pixels through a mask; no foreground is generated. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero/mac-scene.png" alt="" />
      </motion.div>

      <motion.nav
        className="hero-nav"
        initial={noMotion ? false : { opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        aria-label="主要导航"
      >
        <a className="brand-lockup" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="" width="34" height="34" />
          <span>TO-DO PANEL</span>
        </a>
        <div className="hero-nav-links">{NAV_ITEMS.map(([label, href]) => <a href={href} key={label}>{label}</a>)}</div>
      </motion.nav>

      <motion.div
        className="hero-bottom"
        initial={noMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <p>把灵动岛，变成随手可用的工作台。</p>
        <div className="hero-actions">
          <a className="landing-cta landing-cta-primary" href={DOWNLOAD_URL} data-primary-action>下载 macOS 版本</a>
          <a className="landing-cta landing-cta-secondary" href={GITHUB_URL} data-secondary-action>查看 GitHub 仓库</a>
        </div>
      </motion.div>
    </section>
  );
}

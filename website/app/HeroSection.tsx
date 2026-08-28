"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { assetPath } from "./assetPath.mjs";
import { DOWNLOAD_URL, NAV_ITEMS } from "./landingContent";
import { LATEST_RELEASE_API_URL, selectMacDownloadUrl } from "./landingDownload.mjs";
import EchoText from "./reactbits/EchoText/EchoText";
import Magnet from "./reactbits/Magnet/Magnet";
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
  const [downloadPending, setDownloadPending] = useState(false);
  const expanded = panelState === "expanded";

  useEffect(() => {
    const timer = window.setTimeout(() => setEntranceComplete(true), reducedMotion ? 0 : HERO_ENTRANCE_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const togglePanel = () => {
    setPanelState((current) => nextHeroPanelState(current, entranceComplete));
  };

  const startDownload = async (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (downloadPending) return;

    setDownloadPending(true);
    try {
      const response = await fetch(LATEST_RELEASE_API_URL, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!response.ok) throw new Error(`GitHub release request failed: ${response.status}`);
      const downloadUrl = selectMacDownloadUrl(await response.json());
      window.location.assign(downloadUrl ?? DOWNLOAD_URL);
    } catch {
      window.location.assign(DOWNLOAD_URL);
    } finally {
      setDownloadPending(false);
    }
  };

  const noMotion = reducedMotion === true;
  const heroMaskStyle = {
    "--hero-mask-image": `url("${assetPath("/hero/mac-foreground-mask.svg")}")`,
  } as CSSProperties;

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
        <img src={assetPath("/hero/mac-scene-hq.jpg")} alt="" />
      </motion.div>

      <motion.h1
        className="hero-wordmark"
        initial={noMotion ? false : { opacity: 0, y: 38 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <EchoText
          text="TO-DO PANEL"
          tint="#181ecb"
          fontSize="inherit"
          fontWeight="inherit"
          color="#d7e2ea"
          className="hero-echo-text"
        />
      </motion.h1>

      <motion.div
        className="hero-scene-artboard hero-screen-layer"
        initial={noMotion ? false : { opacity: 0, scale: 1.025 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="hero-screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-screen-wallpaper" src={assetPath("/hero/mac-wallpaper-v2.jpg")} alt="Mac 屏幕山脉壁纸" />
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
              <img className="hero-panel-image hero-panel-image-expanded" src={assetPath("/product-captures/home.jpg")} alt="TO-DO Panel 真实首页展开态" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="hero-panel-image hero-panel-image-collapsed" src={assetPath("/hero/panel-collapsed.png")} alt="TO-DO Panel 真实折叠态" />
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
        style={heroMaskStyle}
        initial={noMotion ? false : { opacity: 0, scale: 1.025 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        {/* Reuses original photo pixels through a mask; no foreground is generated. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetPath("/hero/mac-scene-hq.jpg")} alt="" />
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
          <img src={assetPath("/favicon.png")} alt="" width="34" height="34" />
          <span>TO-DO PANEL</span>
        </a>
        <div className="hero-nav-links">
          {NAV_ITEMS.map(([label, href]) => (
            <a
              href={href}
              key={label}
              data-nav-github={label === "GITHUB" ? "" : undefined}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
            >
              {label}
            </a>
          ))}
        </div>
      </motion.nav>

      <motion.div
        className="hero-bottom"
        initial={noMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <p>把灵动岛，变成随手可用的工作台</p>
        <div className="hero-actions">
          <Magnet
            padding={70}
            magnetStrength={6}
            disabled={noMotion}
            wrapperClassName="hero-download-magnet"
            data-magnet="download"
          >
            <a
              className="landing-cta landing-cta-primary"
              href={DOWNLOAD_URL}
              aria-busy={downloadPending}
              data-primary-action
              data-direct-download
              onClick={startDownload}
            >
              下载 macOS 版本
            </a>
          </Magnet>
        </div>
      </motion.div>
    </section>
  );
}

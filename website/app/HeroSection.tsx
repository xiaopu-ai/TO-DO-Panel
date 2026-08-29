"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { assetPath } from "./assetPath.mjs";
import { DOWNLOAD_URL, MARQUEE_ITEMS, NAV_ITEMS, TAB_ITEMS } from "./landingContent";
import { LATEST_RELEASE_API_URL, selectMacDownloadUrl } from "./landingDownload.mjs";
import EchoText from "./reactbits/EchoText/EchoText";
import Magnet from "./reactbits/Magnet/Magnet";
import {
  INITIAL_HERO_PANEL_STATE,
  advanceHeroBootPhase,
  heroBootBreathingProfile,
  heroBootPhase,
  nextHeroPanelState,
  type HeroBootPhase,
  type HeroPanelState,
} from "./landingHero.mjs";

const HERO_ENTRANCE_MS = 1700;
const HERO_BOOT_MINIMUM_MS = 2400;
const HERO_BOOT_TIMEOUT_MS = 8000;
const HERO_BOOT_REVEAL_MS = 1100;
const HERO_BOOT_BREATHING = heroBootBreathingProfile();

export default function HeroSection() {
  const reducedMotion = useReducedMotion();
  const [panelState, setPanelState] = useState<HeroPanelState>(INITIAL_HERO_PANEL_STATE);
  const [bootPhase, setBootPhase] = useState<HeroBootPhase>("loading");
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [downloadPending, setDownloadPending] = useState(false);
  const expanded = panelState === "expanded";

  const noMotion = reducedMotion === true;
  const effectiveBootPhase = noMotion ? heroBootPhase({ reducedMotion: true }) : bootPhase;

  useEffect(() => {
    if (noMotion) return;

    let active = true;
    const imagePromises = MARQUEE_ITEMS.map(({ src }) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Failed to preload ${src}`));
      image.src = src;
    }));
    const firstTabVideo = document.createElement("video");
    const videoPromise = new Promise<void>((resolve, reject) => {
      firstTabVideo.preload = "auto";
      firstTabVideo.muted = true;
      firstTabVideo.playsInline = true;
      firstTabVideo.addEventListener("canplaythrough", () => resolve(), { once: true });
      firstTabVideo.addEventListener("error", () => reject(new Error("Failed to preload first tab video")), { once: true });
      firstTabVideo.src = TAB_ITEMS[0].capture;
      firstTabVideo.load();
    });
    const minimumHoldPromise = new Promise<void>((resolve) => {
      window.setTimeout(resolve, HERO_BOOT_MINIMUM_MS);
    });

    Promise.all([Promise.all([...imagePromises, videoPromise]), minimumHoldPromise]).then(() => {
      if (active) setBootPhase((current) => advanceHeroBootPhase(current, { mediaReady: true, minimumElapsed: true }));
    }).catch(() => {
      // The eight-second fallback below keeps the boot sequence deterministic.
    });

    const fallbackTimer = window.setTimeout(() => {
      if (active) setBootPhase((current) => advanceHeroBootPhase(current, { timedOut: true }));
    }, HERO_BOOT_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      firstTabVideo.removeAttribute("src");
      firstTabVideo.load();
    };
  }, [noMotion]);

  useEffect(() => {
    if (bootPhase !== "revealing") return;
    const timer = window.setTimeout(() => setBootPhase("ready"), HERO_BOOT_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [bootPhase]);

  useEffect(() => {
    if (effectiveBootPhase !== "ready") return;
    const timer = window.setTimeout(() => setEntranceComplete(true), noMotion ? 0 : HERO_ENTRANCE_MS);
    return () => window.clearTimeout(timer);
  }, [effectiveBootPhase, noMotion]);

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

  const contentVisible = effectiveBootPhase === "ready";
  const heroMaskStyle = {
    "--hero-mask-image": `url("${assetPath("/hero/mac-foreground-mask.svg")}")`,
  } as CSSProperties;

  return (
    <section className={`hero-section hero-photographic${entranceComplete ? " is-ready" : ""}`} data-section="hero" data-hero-boot={effectiveBootPhase} id="top">
      <div
        className="hero-scene-artboard hero-scene-base"
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetPath("/hero/mac-scene-hq.jpg")} alt="" fetchPriority="high" />
      </div>

      <motion.h1
        className="hero-wordmark"
        initial={noMotion ? false : { opacity: 0, y: 38 }}
        animate={contentVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 38 }}
        transition={{ duration: 0.6, delay: contentVisible ? 0.12 : 0, ease: [0.22, 1, 0.36, 1] }}
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

      <div
        className="hero-scene-artboard hero-screen-layer"
      >
        <div className="hero-screen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-screen-wallpaper" src={assetPath("/hero/mac-wallpaper-v2.jpg")} alt="Mac 屏幕山脉壁纸" fetchPriority="high" />
          <div className="hero-boot-layer" aria-live="polite" aria-label={effectiveBootPhase === "loading" ? "正在加载产品演示" : undefined}>
            <motion.div
              className="hero-boot-window"
              animate={effectiveBootPhase === "loading" && !noMotion
                ? { width: HERO_BOOT_BREATHING.maskWidth, height: HERO_BOOT_BREATHING.maskHeight }
                : { width: "100%", height: "100%" }}
              transition={effectiveBootPhase === "loading" && !noMotion
                ? { duration: HERO_BOOT_BREATHING.duration, ease: "easeInOut", repeat: Infinity }
                : { duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="hero-boot-frame">
                <motion.img
                  className="hero-boot-wallpaper"
                  src={assetPath("/hero/mac-wallpaper-v2.jpg")}
                  alt=""
                  aria-hidden="true"
                  animate={effectiveBootPhase === "loading" && !noMotion ? { scale: HERO_BOOT_BREATHING.wallpaperScale } : { scale: 1 }}
                  transition={effectiveBootPhase === "loading" && !noMotion ? { duration: HERO_BOOT_BREATHING.duration, ease: "easeInOut", repeat: Infinity } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
                <span className="hero-boot-label">Loading...</span>
              </div>
            </motion.div>
          </div>
          <motion.div
            className="hero-panel-reveal"
            initial={noMotion ? false : { opacity: 0, clipPath: "inset(0 0 100% 0 round 18px)" }}
            animate={contentVisible ? { opacity: 1, clipPath: "inset(0 0 0% 0 round 18px)" } : { opacity: 0, clipPath: "inset(0 0 100% 0 round 18px)" }}
            transition={{ duration: 0.65, delay: contentVisible ? 0.5 : 0, ease: [0.22, 1, 0.36, 1] }}
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
      </div>

      <div
        className="hero-scene-artboard hero-scene-foreground"
        style={heroMaskStyle}
        aria-hidden="true"
      >
        {/* Reuses original photo pixels through a mask; no foreground is generated. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetPath("/hero/mac-scene-hq.jpg")} alt="" fetchPriority="high" />
      </div>

      <motion.nav
        className="hero-nav"
        initial={noMotion ? false : { opacity: 0, y: -16 }}
        animate={contentVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -16 }}
        transition={{ duration: 0.5, delay: contentVisible ? 0.12 : 0 }}
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
        animate={contentVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.65, delay: contentVisible ? 0.5 : 0, ease: [0.22, 1, 0.36, 1] }}
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

"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { type CSSProperties, useRef } from "react";
import RealProductMedia from "./RealProductMedia";
import { TAB_ITEMS, type TabItem } from "./landingContent";

function TabCard({ item, index }: { item: TabItem; index: number }) {
  const trackRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.62, 1], [1, 0.965, 0.94]);
  const opacity = useTransform(scrollYProgress, [0, 0.78, 1], [1, 0.92, 0.72]);
  const layerStyle = { "--stack-index": index + 1 } as CSSProperties;

  return (
    <section className="tab-card-track" data-tab-id={item.id} data-stack-layer={index + 1} ref={trackRef} style={layerStyle}>
      <motion.article className={`tab-card tab-accent-${item.accent}`} style={reducedMotion ? undefined : { scale, opacity }}>
        <header><strong>{String(index + 1).padStart(2, "0")}</strong><div><span>{item.eyebrow}</span><h3>{item.title}</h3><p>{item.description}</p></div></header>
        <RealProductMedia src={item.capture} alt={`${item.title}真实完整面板`} className="tab-capture" fullCapture />
      </motion.article>
    </section>
  );
}

export default function TabStack() {
  return <div className="tab-stack">{TAB_ITEMS.map((item, index) => <TabCard item={item} index={index} key={item.id} />)}</div>;
}

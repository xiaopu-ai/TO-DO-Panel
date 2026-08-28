"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import RealProductMedia from "./RealProductMedia";
import { TAB_ITEMS, type TabItem } from "./landingContent";

function TabCard({ item, index }: { item: TabItem; index: number }) {
  const trackRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.955]);

  return (
    <section className="tab-card-track" data-tab-id={item.id} ref={trackRef}>
      <motion.article className={`tab-card tab-accent-${item.accent}`} style={reducedMotion ? undefined : { scale }}>
        <header><strong>{String(index + 1).padStart(2, "0")}</strong><div><span>{item.eyebrow}</span><h3>{item.title}</h3><p>{item.description}</p></div></header>
        <RealProductMedia src={item.capture} alt={`${item.title}真实完整面板`} className="tab-capture" fullCapture />
      </motion.article>
    </section>
  );
}

export default function TabStack() {
  return <div className="tab-stack">{TAB_ITEMS.map((item, index) => <TabCard item={item} index={index} key={item.id} />)}</div>;
}


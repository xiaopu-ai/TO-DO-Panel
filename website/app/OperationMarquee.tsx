"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import RealProductMedia from "./RealProductMedia";
import { MARQUEE_ITEMS, type MediaItem } from "./landingContent";

function MarqueeRow({ items }: { items: MediaItem[] }) {
  const rowItems = Array.from({ length: 3 }, () => items).flat();
  return <div className="marquee-viewport"><div className="marquee-row">{rowItems.map((item, index) => <RealProductMedia key={`${item.id}-${index}`} src={item.src} fallbackSrc={item.fallbackSrc} kind={item.kind} alt={item.alt} className="marquee-media" />)}</div></div>;
}

export default function OperationMarquee() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const firstX = useTransform(scrollYProgress, [0, 1], [-120, 90]);
  const secondX = useTransform(scrollYProgress, [0, 1], [70, -140]);
  const midpoint = Math.ceil(MARQUEE_ITEMS.length / 2);

  return (
    <section className="marquee-section" data-section="marquee" ref={sectionRef} aria-labelledby="marquee-title">
      <header className="marquee-heading"><h2 id="marquee-title">WORK IN FLOW</h2></header>
      <motion.div style={reducedMotion ? undefined : { x: firstX }}><MarqueeRow items={MARQUEE_ITEMS.slice(0, midpoint)} /></motion.div>
      <motion.div style={reducedMotion ? undefined : { x: secondX }}><MarqueeRow items={MARQUEE_ITEMS.slice(midpoint)} /></motion.div>
    </section>
  );
}

"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const RAYS = ["red", "amber", "green", "blue", "rose", "violet"] as const;

export default function EndingSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end end"] });
  const wordmarkY = useTransform(scrollYProgress, [0, 0.55, 1], [100, 0, -18]);
  const rayScale = useTransform(scrollYProgress, [0, 0.6, 1], [0.18, 1, 0.72]);
  const islandY = useTransform(scrollYProgress, [0, 0.62, 1], [90, 0, -8]);
  const islandScale = useTransform(scrollYProgress, [0, 0.62, 1], [0.45, 1, 1]);

  return (
    <section className="ending-section" data-section="ending" ref={sectionRef}>
      <div className="ending-stage">
        <motion.div
          className="ending-convergence"
          aria-hidden="true"
          style={reducedMotion ? undefined : { scale: rayScale }}
        >
          {RAYS.map((ray) => <i className={`ending-ray ending-ray-${ray}`} key={ray} />)}
        </motion.div>

        <motion.h2
          className="ending-wordmark"
          style={reducedMotion ? undefined : { y: wordmarkY }}
        >
          TO-DO PANEL
        </motion.h2>

        <motion.div
          className="ending-island"
          style={reducedMotion ? undefined : { y: islandY, scale: islandScale }}
        >
          {/* This is the real collapsed-state capture from the running product. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/panel-collapsed.png" alt="TO-DO Panel 真实折叠态" />
        </motion.div>

        <motion.div className="ending-copy">
          <span>BACK TO FLOW</span>
          <p>需要时展开，用完即收起</p>
        </motion.div>

        <footer><span>macOS 14+ · Apple Silicon · MIT</span><span>© 2026 TO-DO Panel</span></footer>
      </div>
    </section>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CAPABILITIES } from "./landingContent";

export default function CapabilitiesSection() {
  const reducedMotion = useReducedMotion();
  return (
    <section className="capabilities-section" data-section="capabilities" id="features">
      <h2>WHAT IT DOES</h2>
      <div className="capabilities-list">{CAPABILITIES.map(([number, title, body], index) => (
        <motion.article key={number} initial={reducedMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.45 }} transition={{ duration: 0.55, delay: reducedMotion ? 0 : index * 0.07 }}>
          <strong>{number}</strong><div><h3>{title}</h3><p>{body}</p></div>
        </motion.article>
      ))}</div>
    </section>
  );
}


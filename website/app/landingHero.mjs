export const INITIAL_HERO_PANEL_STATE = "expanded";

export function heroBootPhase({ mediaReady = false, minimumElapsed = false, timedOut = false, reducedMotion = false } = {}) {
  if (reducedMotion) return "ready";
  if (timedOut || (mediaReady && minimumElapsed)) return "revealing";
  return "loading";
}

export function advanceHeroBootPhase(current, options = {}) {
  if (current !== "loading") return current;
  return heroBootPhase(options);
}

export function heroBootBreathingProfile() {
  return {
    maskWidth: ["62%", "84%", "62%"],
    maskHeight: ["54%", "76%", "54%"],
    wallpaperScale: [1.08, 1.01, 1.08],
    duration: 1.6,
  };
}

export function nextHeroPanelState(current, entranceComplete) {
  if (!entranceComplete) return current;
  return current === "expanded" ? "collapsed" : "expanded";
}

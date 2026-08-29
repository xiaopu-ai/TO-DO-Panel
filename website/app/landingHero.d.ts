export type HeroPanelState = "expanded" | "collapsed";
export type HeroBootPhase = "loading" | "revealing" | "ready";

export const INITIAL_HERO_PANEL_STATE: HeroPanelState;
export function heroBootPhase(options?: {
  mediaReady?: boolean;
  minimumElapsed?: boolean;
  timedOut?: boolean;
  reducedMotion?: boolean;
}): HeroBootPhase;
export function advanceHeroBootPhase(current: HeroBootPhase, options?: {
  mediaReady?: boolean;
  minimumElapsed?: boolean;
  timedOut?: boolean;
  reducedMotion?: boolean;
}): HeroBootPhase;
export function heroBootBreathingProfile(): {
  maskWidth: [string, string, string];
  maskHeight: [string, string, string];
  wallpaperScale: [number, number, number];
  duration: number;
};
export function nextHeroPanelState(current: HeroPanelState, entranceComplete: boolean): HeroPanelState;

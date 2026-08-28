export type HeroPanelState = "expanded" | "collapsed";

export const INITIAL_HERO_PANEL_STATE: HeroPanelState;
export function nextHeroPanelState(current: HeroPanelState, entranceComplete: boolean): HeroPanelState;

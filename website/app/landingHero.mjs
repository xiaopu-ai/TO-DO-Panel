export const INITIAL_HERO_PANEL_STATE = "expanded";

export function nextHeroPanelState(current, entranceComplete) {
  if (!entranceComplete) return current;
  return current === "expanded" ? "collapsed" : "expanded";
}

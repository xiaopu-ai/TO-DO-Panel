export const DEMO_STEPS = Object.freeze([
  { phase: "collapsed", tab: "home", duration: 1200 },
  { phase: "expanding", tab: "home", duration: 800 },
  { phase: "showcase", tab: "home", duration: 2600 },
  { phase: "showcase", tab: "todo", duration: 2200 },
  { phase: "showcase", tab: "links", duration: 2200 },
  { phase: "showcase", tab: "recordings", duration: 2200 },
  { phase: "showcase", tab: "notes", duration: 2200 },
  { phase: "returning", tab: "home", duration: 1400 },
  { phase: "collapsing", tab: "home", duration: 800 },
]);

export function advanceDemoStep(currentIndex) {
  return (currentIndex + 1) % DEMO_STEPS.length;
}

export function getShowcaseStepForTab(tab) {
  const matchingIndex = DEMO_STEPS.findIndex(
    (step) => step.phase === "showcase" && step.tab === tab,
  );
  return matchingIndex === -1 ? 2 : matchingIndex;
}

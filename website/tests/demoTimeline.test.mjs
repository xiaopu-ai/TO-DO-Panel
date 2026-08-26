import test from "node:test";
import assert from "node:assert/strict";

import {
  DEMO_STEPS,
  advanceDemoStep,
  getShowcaseStepForTab,
} from "../app/demoTimeline.mjs";

test("the automatic tour expands, visits all five tabs, returns home, and collapses", () => {
  assert.deepEqual(
    DEMO_STEPS.map(({ phase, tab }) => [phase, tab]),
    [
      ["collapsed", "home"],
      ["expanding", "home"],
      ["showcase", "home"],
      ["showcase", "todo"],
      ["showcase", "links"],
      ["showcase", "recordings"],
      ["showcase", "notes"],
      ["returning", "home"],
      ["collapsing", "home"],
    ],
  );
});

test("advancing after the collapse wraps to the first step", () => {
  assert.equal(advanceDemoStep(DEMO_STEPS.length - 1), 0);
  assert.equal(advanceDemoStep(2), 3);
});

test("manual tab selection resumes from the matching showcase step", () => {
  assert.equal(getShowcaseStepForTab("links"), 4);
  assert.equal(getShowcaseStepForTab("notes"), 6);
  assert.equal(getShowcaseStepForTab("unknown"), 2);
});

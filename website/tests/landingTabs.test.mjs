import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../app/landingTabs.mjs", import.meta.url);

test("tab handoff keeps only the outgoing and incoming cards visible", async () => {
  assert.ok(existsSync(moduleUrl), "landingTabs.mjs must define the shared stack transition");
  const { tabCardVisualState } = await import(moduleUrl.href);

  const states = Array.from({ length: 6 }, (_, index) => tabCardVisualState(0.3, index, 6));
  assert.deepEqual(
    states.map((state, index) => state.opacity > 0 ? index : null).filter((index) => index !== null),
    [1, 2],
  );
  assert.deepEqual(states[1], { phase: "outgoing", yPercent: 5, opacity: 0.5, scale: 0.9825 });
  assert.deepEqual(states[2], { phase: "incoming", yPercent: 52.5, opacity: 1, scale: 1 });
});

test("the outgoing card moves down and fully clears before later cards advance", async () => {
  const { tabCardVisualState } = await import(moduleUrl.href);

  assert.deepEqual(tabCardVisualState(0.4, 1, 6), {
    phase: "past",
    yPercent: 10,
    opacity: 0,
    scale: 0.965,
  });
  assert.deepEqual(tabCardVisualState(0.4, 2, 6), {
    phase: "active",
    yPercent: 0,
    opacity: 1,
    scale: 1,
  });
});

test("only the visible handoff pair keeps animated media mounted", async () => {
  const { shouldLoadTabMedia } = await import(moduleUrl.href);

  assert.deepEqual(
    Array.from({ length: 6 }, (_, index) => shouldLoadTabMedia(0.3, index, 6, false)),
    [false, true, true, false, false, false],
  );
  assert.deepEqual(
    Array.from({ length: 6 }, (_, index) => shouldLoadTabMedia(0.3, index, 6, true)),
    [true, true, true, true, true, true],
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../app/landingHero.mjs", import.meta.url);

test("hero panel ignores early clicks and toggles between real expanded and collapsed states after entrance", async () => {
  assert.ok(existsSync(moduleUrl), "landingHero.mjs must define the Hero interaction contract");
  const { INITIAL_HERO_PANEL_STATE, nextHeroPanelState } = await import(moduleUrl.href);

  assert.equal(INITIAL_HERO_PANEL_STATE, "expanded");
  assert.equal(nextHeroPanelState("expanded", false), "expanded");
  assert.equal(nextHeroPanelState("expanded", true), "collapsed");
  assert.equal(nextHeroPanelState("collapsed", true), "expanded");
});

test("hero boot waits for its minimum hold even when critical media is already cached", async () => {
  const { heroBootPhase } = await import(moduleUrl.href);

  assert.equal(typeof heroBootPhase, "function");
  assert.equal(heroBootPhase({ mediaReady: true, minimumElapsed: false }), "loading");
  assert.equal(heroBootPhase({ mediaReady: true, minimumElapsed: true }), "revealing");
});

test("hero boot reveals after the eight second fallback expires", async () => {
  const { heroBootPhase } = await import(moduleUrl.href);

  assert.equal(heroBootPhase({ mediaReady: false, timedOut: true }), "revealing");
});

test("hero boot skips prolonged animation when reduced motion is enabled", async () => {
  const { heroBootPhase } = await import(moduleUrl.href);

  assert.equal(typeof heroBootPhase, "function");
  assert.equal(heroBootPhase({ mediaReady: false, timedOut: false, reducedMotion: true }), "ready");
});

test("hero boot ignores a late timeout after the entrance is already ready", async () => {
  const { advanceHeroBootPhase } = await import(moduleUrl.href);

  assert.equal(typeof advanceHeroBootPhase, "function");
  assert.equal(advanceHeroBootPhase("ready", { timedOut: true }), "ready");
  assert.equal(advanceHeroBootPhase("revealing", { mediaReady: true }), "revealing");
});

test("hero boot breathing uses two clearly separated mask sizes at a faster cadence", async () => {
  const { heroBootBreathingProfile } = await import(moduleUrl.href);
  const profile = heroBootBreathingProfile();
  const widths = profile.maskWidth.map((value) => Number.parseFloat(value));
  const heights = profile.maskHeight.map((value) => Number.parseFloat(value));

  assert.ok(Math.max(...widths) - Math.min(...widths) >= 20);
  assert.ok(Math.max(...heights) - Math.min(...heights) >= 20);
  assert.ok(profile.duration <= 1.6);
  assert.ok(profile.wallpaperScale[0] > profile.wallpaperScale[1]);
  assert.equal(profile.wallpaperScale[0], profile.wallpaperScale.at(-1));
});

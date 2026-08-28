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

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const moduleUrl = new URL("../app/LandingPage.tsx", import.meta.url);

test("landing page renders the approved section order and one hero CTA", async () => {
  assert.ok(existsSync(moduleUrl), "LandingPage.tsx must render the approved landing experience");
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));

  assert.deepEqual(
    [...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]),
    ["hero", "marquee", "story", "capabilities", "tabs-intro", "tab-stack", "ending"],
  );
  assert.equal((html.match(/data-primary-action=/g) || []).length, 1);
  assert.equal((html.match(/data-secondary-action=/g) || []).length, 0);
  assert.equal((html.match(/data-nav-github=/g) || []).length, 1);
  assert.doesNotMatch(html, /data-section="privacy"/);
});

test("hero renders the approved photographic composition with one real panel toggle", async () => {
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));
  const hero = html.slice(html.indexOf('data-section="hero"'), html.indexOf('data-section="marquee"'));

  assert.match(hero, /把灵动岛，变成随手可用的工作台。/);
  assert.match(hero, />GITHUB</);
  assert.match(hero, />FEATURES</);
  assert.match(hero, />TABS</);
  assert.doesNotMatch(hero, />PRIVACY</);
  assert.doesNotMatch(hero, />ABOUT</);
  assert.equal((hero.match(/aria-expanded="true"/g) || []).length, 1);

  for (const asset of ["/hero/mac-scene-hq.png", "/hero/mac-wallpaper-v2.png", "/product-captures/home.png", "/hero/panel-collapsed.png"]) {
    assert.match(hero, new RegExp(asset.replaceAll("/", "\\/")));
    assert.ok(existsSync(new URL(`../public${asset}`, import.meta.url)), `${asset} must be a real file-backed asset`);
  }
});

test("tab stack renders six ordered cards with one full real-capture surface each", async () => {
  assert.ok(existsSync(moduleUrl), "LandingPage.tsx must render the approved landing experience");
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));

  assert.deepEqual(
    [...html.matchAll(/data-tab-id="([^"]+)"/g)].map((match) => match[1]),
    ["todo", "clipboard", "notes", "links", "recordings", "credentials"],
  );
  assert.equal((html.match(/data-full-capture=/g) || []).length, 6);
  assert.deepEqual(
    [...html.matchAll(/data-stack-layer="([^"]+)"/g)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6],
  );
  assert.doesNotMatch(html, /VIEW TAB|查看功能|tab-detail/);
});

test("ending resolves the experience with the real collapsed panel", async () => {
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));
  const ending = html.slice(html.indexOf('data-section="ending"'));

  assert.match(ending, /需要时展开，用完即收起。/);
  assert.match(ending, /\/hero\/panel-collapsed\.png/);
  assert.doesNotMatch(ending, /data-primary-action|data-secondary-action/);
});

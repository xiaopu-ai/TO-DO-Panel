import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  assert.equal((html.match(/data-direct-download=/g) || []).length, 1);
  assert.equal((html.match(/data-secondary-action=/g) || []).length, 0);
  assert.equal((html.match(/data-nav-github=/g) || []).length, 1);
  assert.doesNotMatch(html, /data-section="privacy"/);
});

test("hero renders the approved photographic composition with one real panel toggle", async () => {
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));
  const hero = html.slice(html.indexOf('data-section="hero"'), html.indexOf('data-section="marquee"'));

  assert.match(hero, /把灵动岛，变成随手可用的工作台</);
  assert.doesNotMatch(hero, /把灵动岛，变成随手可用的工作台。/);
  assert.match(hero, /class="echo-text hero-echo-text"/);
  assert.match(hero, /color-mix\(in srgb, #181ecb/);
  assert.match(hero, /data-magnet="download"/);

  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const heroWordmarkStyles = styles.match(/\.hero-wordmark\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(heroWordmarkStyles, /background(?:-clip)?\s*:/);
  assert.match(hero, />GITHUB</);
  assert.match(hero, />FEATURES</);
  assert.match(hero, />TABS</);
  assert.doesNotMatch(hero, />PRIVACY</);
  assert.doesNotMatch(hero, />ABOUT</);
  assert.equal((hero.match(/aria-expanded="true"/g) || []).length, 1);

  for (const asset of ["/hero/mac-scene-hq.jpg", "/hero/mac-wallpaper-v2.jpg", "/product-captures/home.jpg", "/hero/panel-collapsed.png"]) {
    assert.match(hero, new RegExp(asset.replaceAll("/", "\\/")));
    assert.ok(existsSync(new URL(`../public${asset}`, import.meta.url)), `${asset} must be a real file-backed asset`);
  }

  assert.match(hero, /data-hero-boot="loading"/);
  assert.match(hero, />Loading\.\.\.</);
  assert.match(hero, /class="hero-boot-window"/);
  assert.match(hero, /class="hero-boot-wallpaper"/);
});

test("tab stack renders six ordered cards with one full real-capture surface each", async () => {
  assert.ok(existsSync(moduleUrl), "LandingPage.tsx must render the approved landing experience");
  const { TAB_ITEMS } = await import("../app/landingContent.ts");
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));
  const tabStack = html.slice(html.indexOf('data-section="tab-stack"'), html.indexOf('data-section="ending"'));

  assert.deepEqual(
    TAB_ITEMS.map((item) => item.capture),
    [
      "/tab-captures/todo.mp4",
      "/tab-captures/clipboard.mp4",
      "/tab-captures/notes.mp4",
      "/tab-captures/links.mp4",
      "/tab-captures/recordings.mp4",
      "/tab-captures/credentials.mp4",
    ],
  );
  assert.ok(TAB_ITEMS.every((item) => item.captureKind === "video"));
  assert.ok(TAB_ITEMS.every((item) => existsSync(new URL(`../public${item.capture}`, import.meta.url))));
  assert.ok(TAB_ITEMS.every((item) => item.capturePoster.endsWith(".webp")));
  assert.ok(TAB_ITEMS.every((item) => existsSync(new URL(`../public${item.capturePoster}`, import.meta.url))));

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
  assert.match(html, /一个TAB解决一种高频需求/);
  assert.doesNotMatch(html, /一页解决一种高频动作。继续滚动，六个工作空间依次展开。/);
  assert.doesNotMatch(tabStack, /全桌面循环视频待接入/);
  assert.equal((tabStack.match(/preload="metadata"/g) || []).length, 2);
  assert.equal((tabStack.match(/poster="[^"]+\.webp"/g) || []).length, 2);
  assert.equal((tabStack.match(/data-deferred-media=/g) || []).length, 4);

  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.tab-capture\s*\{[^}]*aspect-ratio:\s*990\s*\/\s*640/);
  assert.match(styles, /@media \(max-height: 800px\)[\s\S]*?\.tab-stack\s*\{\s*width:\s*min\(880px, 100%\)/);
});

test("second screen uses six real feature captures without the home panel", async () => {
  const { MARQUEE_ITEMS } = await import("../app/landingContent.ts");

  assert.deepEqual(
    MARQUEE_ITEMS.map((item) => item.id),
    ["todo", "clipboard", "notes", "links", "recordings", "credentials"],
  );
  assert.ok(MARQUEE_ITEMS.every((item) => item.kind === "image"));
  assert.ok(MARQUEE_ITEMS.every((item) => item.src.endsWith(".webp")));
  assert.ok(MARQUEE_ITEMS.every((item) => item.src && existsSync(new URL(`../public${item.src}`, import.meta.url))));
  assert.ok(MARQUEE_ITEMS.every((item) => !item.id.includes("home")));

  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));
  const marquee = html.slice(html.indexOf('data-section="marquee"'), html.indexOf('data-section="story"'));
  assert.doesNotMatch(marquee, /真实操作，从打开面板到完成任务。/);
});

test("ending resolves the experience with the real collapsed panel", async () => {
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));
  const ending = html.slice(html.indexOf('data-section="ending"'));

  assert.match(ending, /需要时展开，用完即收起</);
  assert.doesNotMatch(ending, /需要时展开，用完即收起。/);
  assert.match(ending, /\/hero\/panel-collapsed\.png/);
  assert.match(ending, /data-prism-animation="hover"/);
  assert.match(ending, /data-prism-noise="0.12"/);
  assert.match(ending, /data-prism-scale="3"/);
  assert.match(ending, /class="prism-container"/);
  assert.doesNotMatch(ending, /ending-convergence|ending-ray/);
  assert.doesNotMatch(ending, /data-primary-action|data-secondary-action/);
});

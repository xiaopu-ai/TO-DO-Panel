import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const moduleUrl = new URL("../app/LandingPage.tsx", import.meta.url);

test("landing page renders the approved section order and one hero CTA pair", async () => {
  assert.ok(existsSync(moduleUrl), "LandingPage.tsx must render the approved landing experience");
  const { default: LandingPage } = await import(moduleUrl.href);
  const html = renderToStaticMarkup(createElement(LandingPage));

  assert.deepEqual(
    [...html.matchAll(/data-section="([^"]+)"/g)].map((match) => match[1]),
    ["hero", "marquee", "story", "capabilities", "tabs-intro", "tab-stack", "privacy", "ending"],
  );
  assert.equal((html.match(/data-primary-action=/g) || []).length, 1);
  assert.equal((html.match(/data-secondary-action=/g) || []).length, 1);
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
  assert.doesNotMatch(html, /VIEW TAB|查看功能|tab-detail/);
});

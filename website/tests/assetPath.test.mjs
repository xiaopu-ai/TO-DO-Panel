import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../app/assetPath.mjs", import.meta.url);

test("public assets are rooted under the GitHub Pages repository path", async () => {
  assert.ok(existsSync(moduleUrl), "assetPath.mjs must support repository-scoped Pages URLs");
  const { assetPathWithBase } = await import(moduleUrl.href);

  assert.equal(assetPathWithBase("/hero/mac-scene-hq.png", "/TO-DO-Panel"), "/TO-DO-Panel/hero/mac-scene-hq.png");
  assert.equal(assetPathWithBase("hero/mac-scene-hq.png", "/TO-DO-Panel/"), "/TO-DO-Panel/hero/mac-scene-hq.png");
  assert.equal(assetPathWithBase("/favicon.png", ""), "/favicon.png");
});

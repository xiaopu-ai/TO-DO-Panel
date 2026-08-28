import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../app/landingMotion.mjs", import.meta.url);

test("magnet movement is clamped and reduced motion returns a stable panel", async () => {
  assert.ok(existsSync(moduleUrl), "landingMotion.mjs must implement the magnet behavior");
  const { getMagnetTransform } = await import(moduleUrl);

  assert.deepEqual(
    getMagnetTransform({ x: 1000, y: -100 }, { width: 800, height: 600 }, false),
    { x: 18, y: -12, rotateX: 1.5, rotateY: 1.5 },
  );
  assert.deepEqual(
    getMagnetTransform({ x: 400, y: 300 }, { width: 800, height: 600 }, true),
    { x: 0, y: 0, rotateX: 0, rotateY: 0 },
  );
});


import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const moduleUrl = new URL("../app/landingMedia.mjs", import.meta.url);

test("real media falls back from a failed recording to a real static capture", async () => {
  assert.ok(existsSync(moduleUrl), "landingMedia.mjs must implement real-media fallback behavior");
  const { initialMediaState, nextMediaState } = await import(moduleUrl);
  const spec = {
    src: "/product-captures/todo.mp4",
    fallbackSrc: "/product-captures/todo.png",
    kind: "video",
  };

  const initial = initialMediaState(spec);
  assert.deepEqual(initial, { src: spec.src, kind: "video", missing: false });
  assert.deepEqual(nextMediaState(initial, spec), {
    src: spec.fallbackSrc,
    kind: "image",
    missing: false,
  });
});

test("real media exposes a neutral missing state when no real capture exists", async () => {
  assert.ok(existsSync(moduleUrl), "landingMedia.mjs must implement real-media fallback behavior");
  const { initialMediaState } = await import(moduleUrl);

  assert.deepEqual(initialMediaState({ src: "", fallbackSrc: "", kind: "image" }), {
    src: "",
    kind: "image",
    missing: true,
  });
});

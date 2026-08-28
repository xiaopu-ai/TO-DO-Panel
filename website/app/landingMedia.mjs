export function initialMediaState({ src = "", fallbackSrc = "", kind = "image" }) {
  if (src) return { src, kind, missing: false };
  if (fallbackSrc) return { src: fallbackSrc, kind: "image", missing: false };
  return { src: "", kind: "image", missing: true };
}

export function nextMediaState(current, { src = "", fallbackSrc = "" }) {
  if (current.src === src && fallbackSrc && fallbackSrc !== src) {
    return { src: fallbackSrc, kind: "image", missing: false };
  }
  return { src: "", kind: "image", missing: true };
}

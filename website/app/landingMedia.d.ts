import type { MediaKind } from "./landingContent";

export type MediaSpec = { src?: string; fallbackSrc?: string; kind?: MediaKind };
export type MediaState = { src: string; kind: MediaKind; missing: boolean };

export function initialMediaState(spec: MediaSpec): MediaState;
export function nextMediaState(current: MediaState, spec: MediaSpec): MediaState;

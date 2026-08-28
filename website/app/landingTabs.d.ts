export type TabCardVisualState = {
  phase: "past" | "outgoing" | "active" | "incoming" | "future";
  yPercent: number;
  opacity: number;
  scale: number;
};

export function tabCardVisualState(progress: number, index: number, count: number): TabCardVisualState;
export function shouldLoadTabMedia(progress: number, index: number, count: number, reducedMotion?: boolean): boolean;

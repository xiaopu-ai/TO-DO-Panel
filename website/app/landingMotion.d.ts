export type MagnetTransform = { x: number; y: number; rotateX: number; rotateY: number };

export function getMagnetTransform(
  pointer: { x: number; y: number },
  bounds: { width: number; height: number },
  reducedMotion?: boolean,
): MagnetTransform;


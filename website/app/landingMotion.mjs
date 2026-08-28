const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getMagnetTransform(pointer, bounds, reducedMotion = false) {
  if (reducedMotion || !bounds.width || !bounds.height) {
    return { x: 0, y: 0, rotateX: 0, rotateY: 0 };
  }

  const normalizedX = pointer.x / bounds.width - 0.5;
  const normalizedY = pointer.y / bounds.height - 0.5;

  return {
    x: clamp(normalizedX * 36, -18, 18),
    y: clamp(normalizedY * 24, -12, 12),
    rotateX: clamp(normalizedY * -3, -1.5, 1.5),
    rotateY: clamp(normalizedX * 3, -1.5, 1.5),
  };
}


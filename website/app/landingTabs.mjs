export function tabCardVisualState(progress, index, count) {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const position = safeProgress * Math.max(0, count - 1);
  const distance = index - position;
  const epsilon = 0.000001;

  if (distance <= -1 + epsilon) {
    return { phase: "past", yPercent: 10, opacity: 0, scale: 0.965 };
  }

  if (distance < -epsilon) {
    const exitProgress = -distance;
    return {
      phase: "outgoing",
      yPercent: exitProgress * 10,
      opacity: 1 - exitProgress,
      scale: 1 - exitProgress * 0.035,
    };
  }

  if (distance <= epsilon) {
    return { phase: "active", yPercent: 0, opacity: 1, scale: 1 };
  }

  if (distance <= 1 + epsilon) {
    return {
      phase: "incoming",
      yPercent: Math.min(1, distance) * 105,
      opacity: 1,
      scale: 1,
    };
  }

  return { phase: "future", yPercent: 105, opacity: 0, scale: 1 };
}

export function shouldLoadTabMedia(progress, index, count, reducedMotion = false) {
  if (reducedMotion) return true;
  const safeProgress = Math.min(1, Math.max(0, progress));
  const position = safeProgress * Math.max(0, count - 1);
  const currentIndex = Math.min(Math.max(0, count - 1), Math.floor(position + 0.000001));
  return index === currentIndex || index === currentIndex + 1;
}

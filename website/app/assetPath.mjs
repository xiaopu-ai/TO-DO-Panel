export function assetPathWithBase(path, basePath = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBase = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  return `${normalizedBase}${normalizedPath}`;
}

export function assetPath(path) {
  return assetPathWithBase(path, process.env.NEXT_PUBLIC_BASE_PATH || "");
}

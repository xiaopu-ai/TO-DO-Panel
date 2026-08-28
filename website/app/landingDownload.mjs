export const LATEST_RELEASE_API_URL = "https://api.github.com/repos/xiaopu-ai/TO-DO-Panel/releases/latest";

export function selectMacDownloadUrl(release) {
  if (!release || !Array.isArray(release.assets)) return null;

  const asset = release.assets.find((candidate) => (
    candidate?.state === "uploaded"
    && typeof candidate.name === "string"
    && candidate.name.endsWith("-arm64.dmg")
    && typeof candidate.browser_download_url === "string"
  ));

  return asset?.browser_download_url ?? null;
}

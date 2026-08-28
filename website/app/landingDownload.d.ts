type ReleaseAsset = {
  name?: string;
  state?: string;
  browser_download_url?: string;
};

type ReleasePayload = { assets?: ReleaseAsset[] } | null;

export const LATEST_RELEASE_API_URL: string;
export function selectMacDownloadUrl(release: ReleasePayload): string | null;

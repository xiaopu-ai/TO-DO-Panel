import { access, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

const clientDirectory = path.resolve("dist/client");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/^\/+|\/+$/g, "");

if (basePath) {
  const prefixedDirectory = path.join(clientDirectory, basePath);
  const generatedAssets = path.join(prefixedDirectory, "_next");
  const publishedAssets = path.join(clientDirectory, "_next");

  try {
    await access(generatedAssets);
    await mkdir(clientDirectory, { recursive: true });
    await rm(publishedAssets, { recursive: true, force: true });
    await rename(generatedAssets, publishedAssets);
    await rm(prefixedDirectory, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

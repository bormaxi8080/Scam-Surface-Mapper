import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distSite = path.join(root, "dist", "site");
const distAssets = path.join(distSite, "assets");

const coreFiles = [
  "src/core/schema.js",
  "src/core/score.js",
  "src/core/extract.js",
  "src/core/aggregate.js",
];

const viewerFiles = [
  "src/viewer/install.js",
  "src/viewer/import-export.js",
  "src/viewer/graph.js",
  "src/viewer/bridge.js",
  "src/viewer/app.js",
];

const collectorFiles = ["src/bookmarklet/collector-entry.js"];

async function load(relativePath) {
  const filePath = path.join(root, relativePath);
  return readFile(filePath, "utf8");
}

function toSingleLineBookmarklet(jsSource) {
  return jsSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("");
}

async function build() {
  await rm(distSite, { recursive: true, force: true });
  await mkdir(distAssets, { recursive: true });

  const indexHtml = await load("site/index.html");

  const coreSource = (await Promise.all(coreFiles.map(load))).join("\n\n");
  const viewerSource = (await Promise.all(viewerFiles.map(load))).join("\n\n");
  const collectorSource = (await Promise.all(collectorFiles.map(load))).join("\n\n");

  const viewerBundle = [coreSource, viewerSource].join("\n\n");
  const collectorBundle = [coreSource, collectorSource].join("\n\n");

  if (!collectorBundle.includes("__SSM_VIEWER_URL__")) {
    throw new Error("Bookmarklet placeholder __SSM_VIEWER_URL__ was not found.");
  }

  const bookmarkletTemplate =
    "javascript:" + toSingleLineBookmarklet(collectorBundle);

  await writeFile(path.join(distSite, "index.html"), indexHtml, "utf8");
  await writeFile(path.join(distAssets, "viewer.js"), viewerBundle, "utf8");
  await writeFile(
    path.join(distAssets, "bookmarklet-template.txt"),
    bookmarkletTemplate,
    "utf8"
  );

  console.log("Pages build complete");
  console.log(`- ${path.relative(root, path.join(distAssets, "viewer.js"))}`);
  console.log(
    `- ${path.relative(root, path.join(distAssets, "bookmarklet-template.txt"))}`
  );
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});

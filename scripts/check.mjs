import fs from "node:fs/promises";
import path from "node:path";

const requiredFiles = [
  "public/index.html",
  "functions/_shared.js",
  "functions/api/publish.js",
  "functions/api/assets.js",
  "functions/api/debug.js",
  "functions/api/status/[id].js",
  "functions/assets/[[path]].js",
  "functions/p/[id].js",
  "scripts/publish.mjs"
];

await Promise.all(
  requiredFiles.map(async (file) => {
    const stat = await fs.stat(path.resolve(file));
    if (!stat.isFile()) throw new Error(`${file} is not a file`);
  })
);

console.log(`MVP file check passed: ${requiredFiles.length} files`);

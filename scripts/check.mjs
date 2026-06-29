import fs from "node:fs/promises";
import path from "node:path";

const requiredFiles = [
  "public/index.html",
  "public/admin.html",
  "public/_routes.json",
  "functions/_shared.js",
  "functions/api/auth/email/send-code.js",
  "functions/api/auth/email/verify.js",
  "functions/api/auth/me.js",
  "functions/api/auth/logout.js",
  "functions/api/tasks.js",
  "functions/api/tasks/[id].js",
  "functions/api/publish.js",
  "functions/api/assets.js",
  "functions/api/credits/balance.js",
  "functions/api/credits/ledger.js",
  "functions/api/credits/plans.js",
  "functions/api/orders.js",
  "functions/admin/users.js",
  "functions/admin/orders.js",
  "functions/admin/credits/adjust.js",
  "functions/api/debug.js",
  "functions/api/status/[id].js",
  "functions/assets/[[path]].js",
  "functions/p/[id].js",
  "migrations/0001_initial.sql",
  "scripts/publish.mjs"
];

await Promise.all(
  requiredFiles.map(async (file) => {
    const stat = await fs.stat(path.resolve(file));
    if (!stat.isFile()) throw new Error(`${file} is not a file`);
  })
);

console.log(`MVP file check passed: ${requiredFiles.length} files`);

import fs from "node:fs/promises";

const [, , inputPath] = process.argv;
const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
const token = process.env.API_TOKEN;

if (!inputPath || !baseUrl) {
  console.error("Usage: PUBLIC_BASE_URL=https://... [API_TOKEN=...] node scripts/publish.mjs note.json");
  process.exit(1);
}

const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
const response = await fetch(`${baseUrl}/api/publish`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify(payload)
});

const result = await response.json();
if (!response.ok) {
  console.error(result.error || "Publish request failed.");
  process.exit(1);
}

console.log(`Task: ${result.id}`);
console.log(`Publish URL: ${result.publishUrl}`);
console.log(`Status URL: ${result.statusUrl}`);
console.log(`Expires: ${result.expiresAt}`);


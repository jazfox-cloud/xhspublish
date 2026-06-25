import { HttpError, createTaskId, getBaseUrl, json, readJson, requireWriteAuth } from "../_shared.js";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  try {
    requireWriteAuth(request, env);

    const input = await readJson(request);
    const contentType = normalizeContentType(input.contentType);
    const extension = extensionFor(contentType);
    const filename = sanitizeFilename(input.filename || `asset.${extension}`);
    const base64 = typeof input.base64 === "string" ? input.base64 : "";
    if (!base64) throw new HttpError(400, "base64 is required.");

    const bytes = Uint8Array.from(atob(stripDataUrlPrefix(base64)), (char) => char.charCodeAt(0));
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new HttpError(413, "Image must be 8 MB or smaller.");

    const key = `assets/${new Date().toISOString().slice(0, 10)}/${createTaskId()}-${filename}`;
    if (env.MEDIA_BUCKET) {
      await env.MEDIA_BUCKET.put(key, bytes, {
        httpMetadata: { contentType },
        customMetadata: { uploadedBy: "xiaohongshu-publish-assistant" }
      });
    } else {
      if (!env.PUBLISH_TASKS) throw new HttpError(500, "Missing MEDIA_BUCKET R2 binding or PUBLISH_TASKS KV fallback.");
      await env.PUBLISH_TASKS.put(key, bytes, {
        expirationTtl: 7 * 24 * 60 * 60,
        metadata: { contentType }
      });
    }

    const publicUrl = env.R2_PUBLIC_BASE_URL
      ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
      : `${getBaseUrl(request, env)}/${key}`;
    return json({ key, publicUrl });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    return json({ error: "Unexpected asset upload error." }, { status: 500 });
  }
}

function normalizeContentType(value) {
  const contentType = typeof value === "string" ? value.toLowerCase() : "";
  if (["image/jpeg", "image/png", "image/webp"].includes(contentType)) return contentType;
  throw new HttpError(400, "contentType must be image/jpeg, image/png, or image/webp.");
}

function extensionFor(contentType) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  }[contentType];
}

function sanitizeFilename(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function stripDataUrlPrefix(value) {
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
}

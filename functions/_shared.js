export const TASK_TTL_SECONDS = 24 * 60 * 60;

export function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

export function html(markup, init = {}) {
  return new Response(markup, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function requireWriteAuth(request, env) {
  if (!env.API_TOKEN) return;
  const expected = `Bearer ${env.API_TOKEN}`;
  if (request.headers.get("authorization") !== expected) {
    throw new HttpError(401, "Missing or invalid API token.");
  }
}

export function requireKv(env) {
  if (!env.PUBLISH_TASKS) {
    throw new HttpError(500, "Missing PUBLISH_TASKS KV binding.");
  }
  return env.PUBLISH_TASKS;
}

export function getBaseUrl(request, env) {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function createTaskId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeTask(input) {
  const title = stringValue(input.title).slice(0, 80);
  const content = stringValue(input.content).slice(0, 5000);
  if (!title) throw new HttpError(400, "title is required.");
  if (!content) throw new HttpError(400, "content is required.");

  const images = arrayOfStrings(input.images).slice(0, 9);
  const topics = arrayOfStrings(input.topics)
    .map((topic) => topic.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    type: "note",
    title,
    content,
    images,
    topics,
    status: "pending",
    source: stringValue(input.source) || "api"
  };
}

export function composeShareText(task) {
  const topics = task.topics?.length ? `\n\n${task.topics.map((topic) => `#${topic}`).join(" ")}` : "";
  return `${task.title}\n\n${task.content}${topics}`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}


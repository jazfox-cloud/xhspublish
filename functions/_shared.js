export const TASK_TTL_SECONDS = 24 * 60 * 60;
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SIGNUP_BONUS_CREDITS = 15;

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

export function requireDb(env) {
  if (!env.DB) {
    throw new HttpError(500, "Missing DB D1 binding.");
  }
  return env.DB;
}

export function requireAdmin(request, env) {
  if (!env.ADMIN_SECRET || request.headers.get("authorization") !== `Bearer ${env.ADMIN_SECRET}`) {
    throw new HttpError(401, "Missing or invalid admin secret.");
  }
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

export function createId(prefix = "") {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}_${id}` : id;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "请输入有效邮箱。");
  }
  return email.slice(0, 254);
}

export function normalizeTask(input) {
  const title = stringValue(input.title).slice(0, 80);
  const content = stringValue(input.content).slice(0, 5000);
  if (!title) throw new HttpError(400, "title is required.");
  if (!content) throw new HttpError(400, "content is required.");

  const images = arrayOfStrings(input.images).slice(0, 18);
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

export async function getCurrentUser(request, env) {
  if (!env.DB) return null;
  const token = readCookie(request, "xhs_session");
  if (!token) return null;
  const now = nowSeconds();
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.display_name, users.avatar_url, users.credit_balance, users.status
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ?`
  )
    .bind(token, now)
    .first();
  if (!row || row.status !== "active") return null;
  return row;
}

export async function requireUser(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) throw new HttpError(401, "请先登录。");
  return user;
}

export function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return [
    `xhs_session=${token}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

export function clearSessionCookie() {
  return "xhs_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
}

export async function createSession(db, userId) {
  const token = createId("sess");
  const createdAt = nowSeconds();
  const expiresAt = createdAt + SESSION_TTL_SECONDS;
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(token, userId, expiresAt, createdAt)
    .run();
  return { token, expiresAt };
}

export async function ensureUserForEmail(db, email) {
  const existing = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (existing) return { user: existing, created: false };

  const id = createId("usr");
  const ledgerId = createId("crd");
  const now = nowSeconds();
  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, email, display_name, credit_balance, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`
      )
      .bind(id, email, email.split("@")[0], SIGNUP_BONUS_CREDITS, now, now),
    db
      .prepare(
        `INSERT INTO credit_ledger (id, user_id, type, amount, balance_after, related_id, note, created_at)
         VALUES (?, ?, 'signup_bonus', ?, ?, NULL, '注册赠送积分', ?)`
      )
      .bind(ledgerId, id, SIGNUP_BONUS_CREDITS, SIGNUP_BONUS_CREDITS, now)
  ]);

  const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  return { user, created: true };
}

export function parseD1Task(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: "note",
    title: row.title,
    content: row.content,
    images: safeJsonArray(row.images_json),
    topics: safeJsonArray(row.topics_json),
    status: row.status,
    source: row.source || "web",
    createdAt: new Date(row.created_at * 1000).toISOString(),
    expiresAt: new Date(row.expires_at * 1000).toISOString(),
    openedAt: row.opened_at ? new Date(row.opened_at * 1000).toISOString() : undefined,
    launchedAt: row.launched_at ? new Date(row.launched_at * 1000).toISOString() : undefined,
    submittedAt: row.submitted_at ? new Date(row.submitted_at * 1000).toISOString() : undefined
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

function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const parts = cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

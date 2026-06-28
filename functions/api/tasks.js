import {
  HttpError,
  TASK_TTL_SECONDS,
  createId,
  createTaskId,
  getBaseUrl,
  json,
  normalizeTask,
  nowSeconds,
  parseD1Task,
  readJson,
  requireDb,
  requireUser
} from "../_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    const db = requireDb(env);
    const user = await requireUser(request, env);
    const rows = await db
      .prepare(
        `SELECT * FROM publish_tasks
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 30`
      )
      .bind(user.id)
      .all();
    return json({ tasks: (rows.results || []).map(parseD1Task) });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env);
    const user = await requireUser(request, env);
    const input = await readJson(request);
    const taskInput = normalizeTask({ ...input, source: "web" });
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

    if (idempotencyKey) {
      const existing = await db
        .prepare("SELECT * FROM publish_tasks WHERE user_id = ? AND idempotency_key = ?")
        .bind(user.id, idempotencyKey)
        .first();
      if (existing) return respondWithTask(request, env, parseD1Task(existing));
    }

    const freshUser = await db.prepare("SELECT credit_balance FROM users WHERE id = ?").bind(user.id).first();
    if (!freshUser || freshUser.credit_balance < 1) {
      throw new HttpError(402, "积分不足，请先购买积分。");
    }

    const now = nowSeconds();
    const taskId = createTaskId();
    const ledgerId = createId("crd");
    const balanceAfter = freshUser.credit_balance - 1;
    const expiresAt = now + TASK_TTL_SECONDS;

    await db.batch([
      db
        .prepare(
          `INSERT INTO credit_ledger (id, user_id, type, amount, balance_after, related_id, note, created_at)
           VALUES (?, ?, 'publish_spend', -1, ?, ?, '创建小红书发布任务', ?)`
        )
        .bind(ledgerId, user.id, balanceAfter, taskId, now),
      db.prepare("UPDATE users SET credit_balance = ?, updated_at = ? WHERE id = ?").bind(balanceAfter, now, user.id),
      db
        .prepare(
          `INSERT INTO publish_tasks (
             id, user_id, title, content, images_json, topics_json, status, source,
             idempotency_key, credit_ledger_id, created_at, expires_at
           )
           VALUES (?, ?, ?, ?, ?, ?, 'pending', 'web', ?, ?, ?, ?)`
        )
        .bind(
          taskId,
          user.id,
          taskInput.title,
          taskInput.content,
          JSON.stringify(taskInput.images),
          JSON.stringify(taskInput.topics),
          idempotencyKey,
          ledgerId,
          now,
          expiresAt
        )
    ]);

    return respondWithTask(request, env, {
      id: taskId,
      ...taskInput,
      createdAt: new Date(now * 1000).toISOString(),
      expiresAt: new Date(expiresAt * 1000).toISOString()
    });
  } catch (error) {
    return handleError(error);
  }
}

function respondWithTask(request, env, task) {
  const baseUrl = getBaseUrl(request, env);
  return json({
    id: task.id,
    publishUrl: `${baseUrl}/p/${task.id}`,
    statusUrl: `${baseUrl}/api/status/${task.id}`,
    expiresAt: task.expiresAt
  });
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  return key ? key.slice(0, 80) : null;
}

function handleError(error) {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
  return json({ error: "任务创建失败。" }, { status: 500 });
}

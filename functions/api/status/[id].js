import { json, nowSeconds, parseD1Task, readJson, requireKv } from "../../_shared.js";

const ALLOWED_STATUS = new Set(["opened", "launched", "submitted"]);

export async function onRequestGet({ params, env }) {
  if (env.DB) {
    const row = await env.DB.prepare("SELECT * FROM publish_tasks WHERE id = ?").bind(params.id).first();
    if (row) return json(taskStatus(parseD1Task(row)));
  }

  const kv = requireKv(env);
  const task = await kv.get(`task:${params.id}`, "json");
  if (!task) return json({ error: "Task not found or expired." }, { status: 404 });

  return json(taskStatus(task));
}

export async function onRequestPost({ request, params, env }) {
  const input = await readJson(request);
  if (!ALLOWED_STATUS.has(input.status)) {
    return json({ error: "Only opened, launched, or submitted status is supported." }, { status: 400 });
  }

  if (env.DB) {
    const column = input.status === "opened" ? "opened_at" : input.status === "launched" ? "launched_at" : "submitted_at";
    const result = await env.DB
      .prepare(`UPDATE publish_tasks SET status = ?, ${column} = ? WHERE id = ?`)
      .bind(input.status, nowSeconds(), params.id)
      .run();
    if (result.meta?.changes) return json({ id: params.id, status: input.status });
  }

  const kv = requireKv(env);
  const task = await kv.get(`task:${params.id}`, "json");
  if (!task) return json({ error: "Task not found or expired." }, { status: 404 });

  task.status = input.status;
  if (input.status === "opened") task.openedAt = new Date().toISOString();
  if (input.status === "launched") task.launchedAt = new Date().toISOString();
  if (input.status === "submitted") task.submittedAt = new Date().toISOString();
  await kv.put(`task:${params.id}`, JSON.stringify(task), {
    expirationTtl: Math.max(60, Math.floor((new Date(task.expiresAt).getTime() - Date.now()) / 1000))
  });

  return json({ id: task.id, status: task.status, submittedAt: task.submittedAt });
}

function taskStatus(task) {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    createdAt: task.createdAt,
    expiresAt: task.expiresAt,
    openedAt: task.openedAt,
    submittedAt: task.submittedAt,
    launchedAt: task.launchedAt,
    error: task.error
  };
}

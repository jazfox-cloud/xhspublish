import { json, readJson, requireKv } from "../../_shared.js";

export async function onRequestGet({ params, env }) {
  const kv = requireKv(env);
  const task = await kv.get(`task:${params.id}`, "json");
  if (!task) return json({ error: "Task not found or expired." }, { status: 404 });

  return json({
    id: task.id,
    type: task.type,
    status: task.status,
    createdAt: task.createdAt,
    expiresAt: task.expiresAt,
    openedAt: task.openedAt,
    submittedAt: task.submittedAt,
    error: task.error
  });
}

export async function onRequestPost({ request, params, env }) {
  const kv = requireKv(env);
  const task = await kv.get(`task:${params.id}`, "json");
  if (!task) return json({ error: "Task not found or expired." }, { status: 404 });

  const input = await readJson(request);
  if (input.status !== "submitted") {
    return json({ error: "Only status=submitted is supported by the mobile page." }, { status: 400 });
  }

  task.status = "submitted";
  task.submittedAt = new Date().toISOString();
  await kv.put(`task:${params.id}`, JSON.stringify(task), {
    expirationTtl: Math.max(60, Math.floor((new Date(task.expiresAt).getTime() - Date.now()) / 1000))
  });

  return json({ id: task.id, status: task.status, submittedAt: task.submittedAt });
}

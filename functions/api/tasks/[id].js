import { HttpError, json, nowSeconds, parseD1Task, readJson, requireDb, requireUser } from "../../_shared.js";

const ALLOWED_STATUS = new Set(["opened", "launched", "submitted"]);

export async function onRequestGet({ request, params, env }) {
  try {
    const db = requireDb(env);
    const user = await requireUser(request, env);
    const row = await db.prepare("SELECT * FROM publish_tasks WHERE id = ? AND user_id = ?").bind(params.id, user.id).first();
    if (!row) throw new HttpError(404, "任务不存在。");
    return json({ task: parseD1Task(row) });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPatch({ request, params, env }) {
  try {
    const db = requireDb(env);
    const user = await requireUser(request, env);
    const input = await readJson(request);
    const status = String(input.status || "").trim();
    if (!ALLOWED_STATUS.has(status)) throw new HttpError(400, "状态不支持。");
    const now = nowSeconds();
    const column = status === "opened" ? "opened_at" : status === "launched" ? "launched_at" : "submitted_at";
    const result = await db
      .prepare(`UPDATE publish_tasks SET status = ?, ${column} = ? WHERE id = ? AND user_id = ?`)
      .bind(status, now, params.id, user.id)
      .run();
    if (!result.meta?.changes) throw new HttpError(404, "任务不存在。");
    return json({ id: params.id, status });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error) {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
  return json({ error: "任务读取失败。" }, { status: 500 });
}

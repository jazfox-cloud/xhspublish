import { HttpError, TASK_TTL_SECONDS, createTaskId, getBaseUrl, json, normalizeTask, readJson, requireKv, requireWriteAuth } from "../_shared.js";

export async function onRequestPost({ request, env }) {
  try {
    requireWriteAuth(request, env);
    const kv = requireKv(env);
    const input = await readJson(request);
    const now = new Date();
    const id = createTaskId();
    const task = {
      id,
      ...normalizeTask(input),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TASK_TTL_SECONDS * 1000).toISOString()
    };

    await kv.put(taskKey(id), JSON.stringify(task), { expirationTtl: TASK_TTL_SECONDS });

    const baseUrl = getBaseUrl(request, env);
    return json({
      id,
      publishUrl: `${baseUrl}/p/${id}`,
      statusUrl: `${baseUrl}/api/status/${id}`,
      expiresAt: task.expiresAt
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestOptions() {
  return json({}, { headers: corsHeaders() });
}

function taskKey(id) {
  return `task:${id}`;
}

function handleError(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status, headers: corsHeaders() });
  }
  return json({ error: "Unexpected publish error." }, { status: 500, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  };
}


import { json, requireWriteAuth } from "../_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    requireWriteAuth(request, env);
    return json({
      envKeys: Object.keys(env).sort(),
      hasPublishTasks: Boolean(env.PUBLISH_TASKS),
      hasMediaBucket: Boolean(env.MEDIA_BUCKET),
      hasApiToken: Boolean(env.API_TOKEN),
      hasPublicBaseUrl: Boolean(env.PUBLIC_BASE_URL)
    });
  } catch (error) {
    return json({ error: error.message || "Debug request failed." }, { status: error.status || 500 });
  }
}

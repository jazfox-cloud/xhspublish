export async function onRequestGet({ params, env }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  const key = `assets/${path}`;
  if (env.MEDIA_BUCKET) {
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return new Response("Asset not found.", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");

    return new Response(object.body, { headers });
  }

  if (!env.PUBLISH_TASKS) {
    return new Response("Missing MEDIA_BUCKET R2 binding or PUBLISH_TASKS KV fallback.", { status: 500 });
  }

  const object = await env.PUBLISH_TASKS.getWithMetadata(key, "arrayBuffer");
  if (!object.value) return new Response("Asset not found.", { status: 404 });

  return new Response(object.value, {
    headers: {
      "content-type": object.metadata?.contentType || "application/octet-stream",
      "cache-control": "public, max-age=86400"
    }
  });
}

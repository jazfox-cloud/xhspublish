export async function onRequestGet({ params, env }) {
  if (!env.MEDIA_BUCKET) {
    return new Response("Missing MEDIA_BUCKET R2 binding.", { status: 500 });
  }

  const key = `assets/${params.path || ""}`;
  const object = await env.MEDIA_BUCKET.get(key);
  if (!object) return new Response("Asset not found.", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

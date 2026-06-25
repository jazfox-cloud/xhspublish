# Xiaohongshu Publish Assistant MVP

Personal-use MVP for moving AI-generated note drafts from an upstream content pipeline to a mobile Xiaohongshu publishing flow.

This version intentionally stays small:

- Create an image-note task through `POST /api/publish`
- Store task data in Cloudflare KV
- Optionally upload base64 images to Cloudflare R2 through `POST /api/assets`
- Upload local JPG, PNG, and WebP images from the web form
- Open a mobile H5 page at `/p/:id`
- Try to open Xiaohongshu, with copy text and image-save fallbacks
- Query task state through `GET /api/status/:id`

Video, history pages, scheduling, batch publishing, and multi-user auth are out of scope for this first MVP.

## Cloudflare Bindings

Create these bindings in Cloudflare Pages:

- `PUBLISH_TASKS`: KV namespace for publish tasks
- `MEDIA_BUCKET`: optional R2 bucket for uploaded images
- `PUBLIC_BASE_URL`: optional env var, for example `https://publish.example.com`
- `R2_PUBLIC_BASE_URL`: optional public R2/custom-domain base URL. If omitted, uploaded assets are served by this app at `/assets/...`
- `API_TOKEN`: optional env var. If set, write APIs require `Authorization: Bearer <token>`

## API

### Create a note task

```bash
curl -X POST "$PUBLIC_BASE_URL/api/publish" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $API_TOKEN" \
  -d '{
    "title": "Example note",
    "content": "Body text",
    "images": ["https://example.com/image.jpg"],
    "topics": ["教辅资料", "学习资料"],
    "source": "api"
  }'
```

The response includes `id`, `publishUrl`, and `expiresAt`.

### Upload an image

```bash
curl -X POST "$PUBLIC_BASE_URL/api/assets" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $API_TOKEN" \
  -d '{"filename":"note.jpg","contentType":"image/jpeg","base64":"..."}'
```

The response includes `publicUrl`. Use that URL in `/api/publish`.

The web form also supports local image upload. Bind an R2 bucket as `MEDIA_BUCKET`, then redeploy the Pages project.

### Local helper

```bash
PUBLIC_BASE_URL=https://publish.example.com \
API_TOKEN=your-token \
node scripts/publish.mjs sample-note.json
```

`sample-note.json` should contain `title`, `content`, optional `images`, and optional `topics`.

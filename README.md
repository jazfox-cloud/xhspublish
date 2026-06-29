# Xiaohongshu Publish Assistant

Cloudflare Pages/Functions app for moving note drafts to a mobile Xiaohongshu publishing flow.

The public MVP now supports:

- Email verification login
- 15 signup bonus credits
- 1 credit spent per created publish task
- D1-backed users, sessions, tasks, credits, orders, and asset records
- Manual recharge orders for the first public test
- A lightweight internal admin page at `/admin.html`
- Optional image uploads to Cloudflare R2, with KV fallback
- Open a mobile H5 page at `/p/:id`
- Launch Xiaohongshu publish routes with copy text and image-save fallbacks

Wechat login and WeChat Pay are intentionally left as later integrations because they require platform and merchant-account approval.

## Cloudflare Bindings

Create these bindings in Cloudflare Pages:

- `DB`: D1 database. Run `migrations/0001_initial.sql` before public testing.
- `PUBLISH_TASKS`: KV namespace for publish tasks
- `MEDIA_BUCKET`: optional R2 bucket for uploaded images. If omitted, uploaded images fall back to `PUBLISH_TASKS` KV with a 7-day TTL.
- `PUBLIC_BASE_URL`: optional env var, for example `https://publish.example.com`
- `R2_PUBLIC_BASE_URL`: optional public R2/custom-domain base URL. If omitted, uploaded assets are served by this app at `/assets/...`
- `API_TOKEN`: optional env var for the private upstream API (`POST /api/publish`) and token-based uploads
- `ADMIN_SECRET`: admin-only token for manual credit adjustment
- `RESEND_API_KEY`: optional, for real email verification delivery
- `EMAIL_FROM`: optional, for example `XHS Publish <login@example.com>`

## API

### Email login

```bash
curl -X POST "$PUBLIC_BASE_URL/api/auth/email/send-code" \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com"}'
```

If `RESEND_API_KEY` and `EMAIL_FROM` are missing, the response includes `devCode` for testing.

```bash
curl -X POST "$PUBLIC_BASE_URL/api/auth/email/verify" \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com","code":"123456"}'
```

The verify endpoint sets an HttpOnly `xhs_session` cookie. First login creates the user and grants 15 credits.

### Create a logged-in task

```bash
curl -X POST "$PUBLIC_BASE_URL/api/tasks" \
  -H "content-type: application/json" \
  -b "xhs_session=..." \
  -d '{
    "title": "Example note",
    "content": "Body text",
    "images": ["https://example.com/image.jpg"],
    "topics": ["教辅资料", "学习资料"]
  }'
```

This spends 1 credit and returns `publishUrl`.

### Create a note task

This private compatibility endpoint keeps the original API-token workflow for upstream automation.

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
  -b "xhs_session=..." \
  -d '{"filename":"note.jpg","contentType":"image/jpeg","base64":"..."}'
```

The response includes `publicUrl`. Logged-in browser uploads use the session cookie. Private automation may also use `Authorization: Bearer $API_TOKEN`.

### Manual credit adjustment

Open `/admin.html`, enter `ADMIN_SECRET`, then refresh users/orders and adjust credits from the browser.

The same action is also available as an API:

```bash
curl -X POST "$PUBLIC_BASE_URL/admin/credits/adjust" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $ADMIN_SECRET" \
  -d '{"userId":"usr_...","amount":30,"relatedId":"ord_...","note":"手动充值"}'
```

For heavier image use, bind an R2 bucket as `MEDIA_BUCKET`, then redeploy the Pages project.

### Local helper

```bash
PUBLIC_BASE_URL=https://publish.example.com \
API_TOKEN=your-token \
node scripts/publish.mjs sample-note.json
```

`sample-note.json` should contain `title`, `content`, optional `images`, and optional `topics`.

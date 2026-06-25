import { TASK_TTL_SECONDS, composeShareText, escapeHtml, html, requireKv } from "../_shared.js";

export async function onRequestGet({ params, env }) {
  const kv = requireKv(env);
  const task = await kv.get(`task:${params.id}`, "json");
  if (!task) {
    return html(renderExpired(), { status: 404 });
  }

  if (task.status === "pending") {
    task.status = "opened";
    task.openedAt = new Date().toISOString();
    await kv.put(`task:${params.id}`, JSON.stringify(task), { expirationTtl: TASK_TTL_SECONDS });
  }

  return html(renderTask(task));
}

function renderExpired() {
  return page("任务已过期", "<p>这个发布任务不存在或已经过期，请重新生成。</p>");
}

function renderTask(task) {
  const shareText = composeShareText(task);
  const imageHtml = task.images?.length
    ? task.images
        .map(
          (image, index) => `
            <a class="image" href="${escapeHtml(image)}" target="_blank" rel="noreferrer">
              <img alt="发布图片 ${index + 1}" src="${escapeHtml(image)}" loading="lazy" />
            </a>
          `
        )
        .join("")
    : '<p class="muted">这个任务没有图片。</p>';

  return page(
    task.title,
    `
      <section class="actions">
        <button id="open-xhs">复制并尝试打开小红书</button>
        <button id="copy-text" class="secondary">复制标题正文话题</button>
      </section>
      <section class="manual">
        <h2>发布步骤</h2>
        <ol>
          <li>点“复制标题正文话题”。</li>
          <li>长按下面图片保存到相册。</li>
          <li>手动打开小红书，选择图片，新建笔记并粘贴文案。</li>
        </ol>
        <p class="muted">如果下面的打开入口没有反应，说明当前手机/浏览器不支持这个小红书唤起方式；这不影响复制和保存图片的半自动流程。</p>
        <div class="link-actions">
          <a href="https://www.xiaohongshu.com" target="_blank" rel="noreferrer">打开小红书网页</a>
          <a href="xhsdiscover://">测试 xhsdiscover://</a>
        </div>
      </section>
      <button id="mark-submitted" class="wide" type="button">我已在小红书发布</button>

      <section>
        <h2>发布文案</h2>
        <textarea id="share-text" readonly>${escapeHtml(shareText)}</textarea>
      </section>

      <section>
        <h2>图片</h2>
        <p class="muted">长按图片保存到相册；如果唤起失败，就手动打开小红书上传。</p>
        <div class="grid">${imageHtml}</div>
      </section>

      <script>
        const shareText = document.querySelector("#share-text");
        document.querySelector("#copy-text").addEventListener("click", async () => {
          await navigator.clipboard.writeText(shareText.value);
          toast("文案已复制");
        });
        document.querySelector("#open-xhs").addEventListener("click", async () => {
          await navigator.clipboard.writeText(shareText.value);
          toast("已复制文案，正在尝试打开小红书");
          window.location.href = "xhsdiscover://";
          setTimeout(() => {
            toast("如果没有打开 App，请手动打开小红书并粘贴文案。");
          }, 1600);
        });
        document.querySelector("#mark-submitted").addEventListener("click", async () => {
          const response = await fetch("/api/status/${escapeHtml(task.id)}", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "submitted" })
          });
          toast(response.ok ? "状态已标记为已发布" : "状态更新失败，请稍后再试");
        });
        function toast(message) {
          const node = document.querySelector("#toast");
          node.textContent = message;
          node.hidden = false;
        }
      </script>
    `
  );
}

function page(title, body) {
  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)} - 小红书扫码发布助手</title>
        <style>
          :root {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f7f7f8;
            color: #18181b;
          }
          * { box-sizing: border-box; }
          body { margin: 0; }
          main {
            width: min(680px, calc(100vw - 28px));
            margin: 0 auto;
            padding: 24px 0 40px;
          }
          h1 { margin: 0 0 8px; font-size: 26px; line-height: 1.2; }
          h2 { margin: 24px 0 10px; font-size: 18px; }
          p { line-height: 1.6; }
          textarea {
            width: 100%;
            min-height: 220px;
            padding: 12px;
            border: 1px solid #d4d4d8;
            border-radius: 8px;
            font: inherit;
            line-height: 1.55;
            background: #fff;
          }
          button {
            min-height: 46px;
            border: 0;
            border-radius: 8px;
            padding: 0 14px;
            background: #ff2442;
            color: #fff;
            font: inherit;
            font-weight: 750;
          }
          .secondary { background: #27272a; }
          .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 18px 0; }
          .wide { width: 100%; background: #18181b; }
          .manual {
            margin: 18px 0;
            padding: 14px;
            border: 1px solid #e4e4e7;
            border-radius: 8px;
            background: #fff;
          }
          .manual h2 { margin-top: 0; }
          .manual ol { padding-left: 22px; line-height: 1.65; }
          .link-actions { display: flex; gap: 10px; flex-wrap: wrap; }
          .link-actions a {
            display: inline-flex;
            min-height: 38px;
            align-items: center;
            border-radius: 8px;
            padding: 0 12px;
            background: #f4f4f5;
            color: #18181b;
            text-decoration: none;
            font-weight: 650;
          }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .image {
            display: block;
            overflow: hidden;
            border-radius: 8px;
            border: 1px solid #e4e4e7;
            background: #fff;
          }
          .image img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
          .muted { color: #71717a; font-size: 14px; }
          #toast {
            position: sticky;
            bottom: 12px;
            margin-top: 18px;
            padding: 12px;
            border-radius: 8px;
            background: #18181b;
            color: #fff;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>${escapeHtml(title)}</h1>
          ${body}
          <div id="toast" hidden></div>
        </main>
      </body>
    </html>`;
}

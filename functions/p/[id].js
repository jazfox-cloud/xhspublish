import { TASK_TTL_SECONDS, composeShareText, escapeHtml, html, nowSeconds, parseD1Task, requireKv } from "../_shared.js";

export async function onRequestGet({ params, env }) {
  const task = await getTask(params.id, env);
  if (!task) {
    return html(renderExpired(), { status: 404 });
  }

  if (task.status === "pending") {
    task.status = "opened";
    task.openedAt = new Date().toISOString();
    await markOpened(params.id, task, env);
  }

  return html(renderTask(task));
}

async function getTask(id, env) {
  if (env.DB) {
    const row = await env.DB.prepare("SELECT * FROM publish_tasks WHERE id = ? AND expires_at > ?").bind(id, nowSeconds()).first();
    if (row) return parseD1Task(row);
  }
  const kv = requireKv(env);
  return kv.get(`task:${id}`, "json");
}

async function markOpened(id, task, env) {
  if (env.DB && task.userId) {
    await env.DB.prepare("UPDATE publish_tasks SET status = 'opened', opened_at = ? WHERE id = ?").bind(nowSeconds(), id).run();
    return;
  }
  const kv = requireKv(env);
  await kv.put(`task:${id}`, JSON.stringify(task), { expirationTtl: TASK_TTL_SECONDS });
}

function renderExpired() {
  return page("任务已过期", "<p>这个发布任务不存在或已经过期，请重新生成。</p>");
}

function renderTask(task) {
  const shareText = composeShareText(task);
  const images = Array.isArray(task.images) ? task.images : [];
  const imageJson = escapeScriptJson(images);
  const titleJson = escapeScriptJson(task.title);
  const shareTextJson = escapeScriptJson(shareText);
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
        <button id="open-xhs">发布到小红书</button>
        <button id="copy-text" class="secondary">复制标题正文话题</button>
      </section>
      <section class="manual">
        <h2>发布步骤</h2>
        <ol>
          <li>点击“发布到小红书”，进入小红书发布编辑页。</li>
          <li>确认图片、标题、正文和话题无误。</li>
          <li>在小红书 App 内点击发布。</li>
        </ol>
        <p class="muted">如果跳转失败，可复制文案并长按保存图片后手动发布。</p>
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
        const taskTitle = ${titleJson};
        const taskImages = ${imageJson};
        const taskShareText = ${shareTextJson};
        const shareText = document.querySelector("#share-text");
        document.querySelector("#copy-text").addEventListener("click", async () => {
          await navigator.clipboard.writeText(shareText.value);
          toast("文案已复制");
        });
        document.querySelector("#open-xhs").addEventListener("click", async () => {
          await navigator.clipboard.writeText(shareText.value);
          toast("正在打开小红书发布页");
          fetch("/api/status/${escapeHtml(task.id)}", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "launched" })
          }).catch(() => {});
          openXhsPublish();
          setTimeout(() => {
            toast("如果没有进入发布页，请复制文案并手动发布。");
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
        function openXhsPublish() {
          const route = buildXhsPublishRoute({
            title: taskTitle,
            content: taskShareText,
            images: taskImages,
            type: "normal"
          });
          if (!route) {
            toast("当前内容缺少可发布图片。");
            return;
          }
          window.location.href = route;
        }
        function buildXhsPublishRoute(note) {
          if (!note.images || !note.images.length) return "";
          const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
          const isAndroid = /Android/i.test(navigator.userAgent);
          if (isAndroid) {
            const data = {
              note_info: {
                title: { value: note.title || "" },
                content: { value: note.content || "" },
                image_info: note.images.map((url) => ({ uri: null, url }))
              },
              share_type: "note",
              sdk_version: "1.0.0",
              third_app_package: "system_album_other",
              third_app_version: "1.0.0",
              share_session_id: "xhs_" + Date.now() + "_" + Math.random().toString(36).slice(2),
              did: "",
              start_share_timestamp: Date.now(),
              fromJsSdk: false
            };
            return "xhsdiscover://share_sdk?data=" + encodeURIComponent(base64Json(data));
          }
          if (isIOS) {
            const content = toIosTopicContent(note.content || "");
            const attach = {
              image_resources: note.images.map((url) => ({
                image_url: url,
                url,
                imageUrl: url,
                uri: url
              })),
              images: note.images,
              note_title: note.title || "",
              note_text: content,
              note_text_v2: { content },
              now_edit_info: { tti_open_keyboard: false }
            };
            const page = { page_type: "photo_publish" };
            const source = {
              type: "system_album_other",
              externalSource: "xhspublish_direct",
              extraInfo: { subType: "external_app" }
            };
            const schema =
              "xhsdiscover://post_new_note?attach=" + encodeURIComponent(JSON.stringify(attach)) +
              "&page=" + encodeURIComponent(JSON.stringify(page)) +
              "&source=" + encodeURIComponent(JSON.stringify(source));
            return "https://oia.xiaohongshu.com/oia?deeplink=" + encodeURIComponent(schema);
          }
          return "";
        }
        function base64Json(value) {
          const json = JSON.stringify(value);
          if (typeof TextEncoder !== "undefined") {
            const bytes = new TextEncoder().encode(json);
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            return btoa(binary);
          }
          return btoa(unescape(encodeURIComponent(json)));
        }
        function toIosTopicContent(value) {
          return String(value).replace(/(^|\\s)#([^\\s#\\[\\]{}()（）<>《》【】.,，。!！?？;；:：、/\\\\|"“”‘’~@$%^&*=+]+)/g, (match, prefix, topic) => {
            if (match.includes("[话题]#")) return match;
            return prefix + "#" + topic + "[话题]#";
          });
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

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

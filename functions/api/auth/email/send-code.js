import { HttpError, createId, json, normalizeEmail, readJson, requireKv } from "../../../_shared.js";

const CODE_TTL_SECONDS = 10 * 60;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function onRequestPost({ request, env }) {
  try {
    const kv = requireKv(env);
    const input = await readJson(request);
    const email = normalizeEmail(input.email);
    const rateKey = `auth:rate:${email}`;
    const recent = await kv.get(rateKey);
    if (recent) throw new HttpError(429, "验证码发送太频繁，请 1 分钟后再试。");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await kv.put(`auth:email:${email}`, code, { expirationTtl: CODE_TTL_SECONDS });
    await kv.put(rateKey, "1", { expirationTtl: 60 });

    const delivery = await sendEmailCode(env, email, code);
    return json({
      ok: true,
      sent: delivery.sent,
      message: delivery.message,
      ...(delivery.sent ? {} : { devCode: code, emailError: delivery.error })
    });
  } catch (error) {
    return handleError(error);
  }
}

async function sendEmailCode(env, email, code) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return { sent: false, message: "未配置邮件服务，已返回测试验证码。", error: "missing_email_config" };
  }
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email,
      subject: "小红书发布助手登录验证码",
      html: `<p>你的登录验证码是：</p><h2>${code}</h2><p>10 分钟内有效。如果不是你本人操作，请忽略这封邮件。</p>`,
      headers: { "X-Entity-Ref-ID": createId("mail") }
    })
  });
  if (response.ok) return { sent: true, message: "验证码已发送，请查收邮箱。" };

  const text = await response.text();
  return {
    sent: false,
    message: "邮件服务返回错误，已返回测试验证码。",
    error: `resend_${response.status}: ${text.slice(0, 300)}`
  };
}

function handleError(error) {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
  return json({ error: "验证码发送失败。" }, { status: 500 });
}

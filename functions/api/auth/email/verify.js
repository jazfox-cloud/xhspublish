import { HttpError, createSession, ensureUserForEmail, json, normalizeEmail, readJson, requireDb, requireKv, sessionCookie } from "../../../_shared.js";

export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env);
    const kv = requireKv(env);
    const input = await readJson(request);
    const email = normalizeEmail(input.email);
    const code = String(input.code || "").trim();
    if (!/^\d{6}$/.test(code)) throw new HttpError(400, "请输入 6 位验证码。");

    const stored = await kv.get(`auth:email:${email}`);
    if (!stored || stored !== code) throw new HttpError(400, "验证码错误或已过期。");
    await kv.delete(`auth:email:${email}`);

    const { user, created } = await ensureUserForEmail(db, email);
    const session = await createSession(db, user.id);
    return json(
      {
        ok: true,
        created,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          creditBalance: user.credit_balance
        },
        sessionExpiresAt: session.expiresAt
      },
      { headers: { "set-cookie": sessionCookie(session.token) } }
    );
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    return json({ error: "登录失败。" }, { status: 500 });
  }
}

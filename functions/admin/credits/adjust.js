import { HttpError, createId, json, nowSeconds, readJson, requireDb } from "../../_shared.js";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_SECRET || request.headers.get("authorization") !== `Bearer ${env.ADMIN_SECRET}`) {
      throw new HttpError(401, "Missing or invalid admin secret.");
    }
    const db = requireDb(env);
    const input = await readJson(request);
    const userId = String(input.userId || "").trim();
    const amount = Number(input.amount);
    const relatedId = input.relatedId ? String(input.relatedId).trim() : null;
    const note = String(input.note || "管理员调整积分").slice(0, 200);
    if (!userId) throw new HttpError(400, "userId is required.");
    if (!Number.isInteger(amount) || amount === 0) throw new HttpError(400, "amount must be a non-zero integer.");

    const user = await db.prepare("SELECT credit_balance FROM users WHERE id = ?").bind(userId).first();
    if (!user) throw new HttpError(404, "User not found.");
    const now = nowSeconds();
    const balanceAfter = user.credit_balance + amount;
    if (balanceAfter < 0) throw new HttpError(400, "Insufficient balance after adjustment.");
    const ledgerId = createId("crd");

    await db.batch([
      db.prepare("UPDATE users SET credit_balance = ?, updated_at = ? WHERE id = ?").bind(balanceAfter, now, userId),
      db
        .prepare(
          `INSERT INTO credit_ledger (id, user_id, type, amount, balance_after, related_id, note, created_at)
           VALUES (?, ?, 'admin_adjust', ?, ?, ?, ?, ?)`
        )
        .bind(ledgerId, userId, amount, balanceAfter, relatedId, note, now)
    ]);

    return json({ ok: true, userId, amount, balanceAfter, ledgerId });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    return json({ error: "Admin credit adjustment failed." }, { status: 500 });
  }
}

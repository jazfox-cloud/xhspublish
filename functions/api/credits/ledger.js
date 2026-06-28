import { HttpError, json, requireDb, requireUser } from "../../_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    const db = requireDb(env);
    const user = await requireUser(request, env);
    const rows = await db
      .prepare(
        `SELECT id, type, amount, balance_after, related_id, note, created_at
         FROM credit_ledger
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .bind(user.id)
      .all();
    return json({
      ledger: (rows.results || []).map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount,
        balanceAfter: row.balance_after,
        relatedId: row.related_id,
        note: row.note,
        createdAt: new Date(row.created_at * 1000).toISOString()
      }))
    });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    return json({ error: "积分流水读取失败。" }, { status: 500 });
  }
}

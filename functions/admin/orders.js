import { HttpError, json, requireAdmin, requireDb } from "../_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    requireAdmin(request, env);
    const db = requireDb(env);
    const url = new URL(request.url);
    const status = String(url.searchParams.get("status") || "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);

    const stmt = status
      ? db.prepare(
          `SELECT orders.id, orders.user_id, users.email, orders.credits_amount, orders.price_fen,
                  orders.status, orders.payment_method, orders.paid_at, orders.created_at
           FROM orders
           JOIN users ON users.id = orders.user_id
           WHERE orders.status = ?
           ORDER BY orders.created_at DESC
           LIMIT ?`
        ).bind(status, limit)
      : db.prepare(
          `SELECT orders.id, orders.user_id, users.email, orders.credits_amount, orders.price_fen,
                  orders.status, orders.payment_method, orders.paid_at, orders.created_at
           FROM orders
           JOIN users ON users.id = orders.user_id
           ORDER BY orders.created_at DESC
           LIMIT ?`
        ).bind(limit);

    const rows = await stmt.all();
    return json({
      orders: (rows.results || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        creditsAmount: row.credits_amount,
        priceFen: row.price_fen,
        status: row.status,
        paymentMethod: row.payment_method,
        paidAt: row.paid_at ? new Date(row.paid_at * 1000).toISOString() : null,
        createdAt: new Date(row.created_at * 1000).toISOString()
      }))
    });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    return json({ error: "Admin orders query failed." }, { status: 500 });
  }
}

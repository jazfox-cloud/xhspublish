import { CREDIT_PLANS } from "./credits/plans.js";
import { HttpError, createId, json, nowSeconds, readJson, requireDb, requireUser } from "../_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    const db = requireDb(env);
    const user = await requireUser(request, env);
    const rows = await db
      .prepare(
        `SELECT id, credits_amount, price_fen, status, payment_method, paid_at, created_at
         FROM orders
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 30`
      )
      .bind(user.id)
      .all();
    return json({
      orders: (rows.results || []).map((row) => ({
        id: row.id,
        creditsAmount: row.credits_amount,
        priceFen: row.price_fen,
        status: row.status,
        paymentMethod: row.payment_method,
        paidAt: row.paid_at ? new Date(row.paid_at * 1000).toISOString() : null,
        createdAt: new Date(row.created_at * 1000).toISOString()
      }))
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const db = requireDb(env);
    const user = await requireUser(request, env);
    const input = await readJson(request);
    const plan = CREDIT_PLANS.find((item) => item.id === input.planId);
    if (!plan) throw new HttpError(400, "套餐不存在。");

    const id = createId("ord");
    const now = nowSeconds();
    await db
      .prepare(
        `INSERT INTO orders (id, user_id, credits_amount, price_fen, status, payment_method, created_at)
         VALUES (?, ?, ?, ?, 'pending', 'manual', ?)`
      )
      .bind(id, user.id, plan.credits, plan.priceFen, now)
      .run();

    return json({
      order: {
        id,
        planId: plan.id,
        creditsAmount: plan.credits,
        priceFen: plan.priceFen,
        status: "pending",
        paymentMethod: "manual",
        paymentHint: "当前为内测手动充值：付款后把订单号发给管理员，由管理员确认加积分。"
      }
    });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error) {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
  return json({ error: "订单处理失败。" }, { status: 500 });
}

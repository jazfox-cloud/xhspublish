import { HttpError, json, requireUser } from "../../_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    const user = await requireUser(request, env);
    return json({ creditBalance: user.credit_balance });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    return json({ error: "积分余额读取失败。" }, { status: 500 });
  }
}

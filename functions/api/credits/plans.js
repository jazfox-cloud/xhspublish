import { json } from "../../_shared.js";

export const CREDIT_PLANS = [
  { id: "starter", name: "入门包", priceFen: 990, credits: 30, description: "适合轻量试用" },
  { id: "standard", name: "标准包", priceFen: 2900, credits: 120, description: "适合稳定日更" },
  { id: "pro", name: "专业包", priceFen: 9900, credits: 500, description: "适合团队或矩阵账号" }
];

export async function onRequestGet() {
  return json({ plans: CREDIT_PLANS });
}

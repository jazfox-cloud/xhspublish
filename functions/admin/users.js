import { HttpError, json, requireAdmin, requireDb } from "../_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    requireAdmin(request, env);
    const db = requireDb(env);
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);

    const stmt = q
      ? db.prepare(
          `SELECT id, email, display_name, credit_balance, status, created_at, updated_at
           FROM users
           WHERE lower(email) LIKE ? OR lower(id) LIKE ?
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(`%${q}%`, `%${q}%`, limit)
      : db.prepare(
          `SELECT id, email, display_name, credit_balance, status, created_at, updated_at
           FROM users
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(limit);

    const rows = await stmt.all();
    return json({
      users: (rows.results || []).map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        creditBalance: row.credit_balance,
        status: row.status,
        createdAt: new Date(row.created_at * 1000).toISOString(),
        updatedAt: new Date(row.updated_at * 1000).toISOString()
      }))
    });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
    return json({ error: "Admin users query failed." }, { status: 500 });
  }
}

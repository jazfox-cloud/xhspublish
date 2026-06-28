import { json, getCurrentUser } from "../../_shared.js";

export async function onRequestGet({ request, env }) {
  const user = await getCurrentUser(request, env);
  return json({
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          creditBalance: user.credit_balance
        }
      : null
  });
}

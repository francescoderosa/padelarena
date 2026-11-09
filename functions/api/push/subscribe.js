import {
  isValidSubscription,
  jsonResponse,
  optionsResponse,
  readJson,
} from './_shared.js';

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost({ request, env }) {
  if (!env.PUSH_DB) {
    return jsonResponse({ error: 'Database push non configurato sul server' }, 503);
  }

  const body = await readJson(request);
  const subscription = body?.subscription;
  const installId = typeof body?.installId === 'string' ? body.installId.slice(0, 128) : '';

  if (!installId || !isValidSubscription(subscription)) {
    return jsonResponse({ error: 'Subscription non valida' }, 400);
  }

  const now = Date.now();
  await env.PUSH_DB.prepare(`
    INSERT INTO push_subscriptions
      (endpoint, install_id, p256dh, auth, user_agent, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      install_id = excluded.install_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      enabled = 1,
      updated_at = excluded.updated_at
  `).bind(
    subscription.endpoint,
    installId,
    subscription.keys.p256dh,
    subscription.keys.auth,
    request.headers.get('User-Agent')?.slice(0, 500) || null,
    now,
    now,
  ).run();

  return jsonResponse({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  if (!env.PUSH_DB) {
    return jsonResponse({ error: 'Database push non configurato sul server' }, 503);
  }

  const body = await readJson(request);
  if (typeof body?.endpoint !== 'string' || !body.endpoint.startsWith('https://')) {
    return jsonResponse({ error: 'Endpoint non valido' }, 400);
  }

  await env.PUSH_DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
    .bind(body.endpoint)
    .run();

  return jsonResponse({ ok: true });
}

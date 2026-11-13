import { sendPushBatch } from '@mmmike/web-push';
import { requireAdminAuth } from '../_admin.js';
import { jsonResponse, optionsResponse, readJson } from './_shared.js';

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost({ request, env }) {
  if (!env.PUSH_DB || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return jsonResponse({ error: 'Web Push non configurato sul server' }, 503);
  }

  const authError = requireAdminAuth(request, env);
  if (authError) return authError;

  const body = await readJson(request);
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : '';
  const notificationBody = typeof body?.body === 'string' ? body.body.trim().slice(0, 500) : '';
  const url = typeof body?.url === 'string' && body.url.startsWith('/') ? body.url : '/';
  const tag = typeof body?.tag === 'string' ? body.tag.trim().slice(0, 64) : 'controvetro-announcement';

  if (!title) {
    return jsonResponse({ error: 'Il titolo della notifica è obbligatorio' }, 400);
  }

  const rows = await env.PUSH_DB.prepare(`
    SELECT endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE enabled = 1
  `).all();
  const subscriptions = (rows.results || []).map(row => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
  }));

  const result = await sendPushBatch(
    subscriptions,
    { title, body: notificationBody, url, tag },
    {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    },
    { ttl: 86400, urgency: 'normal', concurrency: 20, timeoutMs: 10000 },
  );

  if (result.gone.length > 0) {
    const placeholders = result.gone.map(() => '?').join(', ');
    await env.PUSH_DB.prepare(
      `DELETE FROM push_subscriptions WHERE endpoint IN (${placeholders})`,
    ).bind(...result.gone).run();
  }

  return jsonResponse({
    ok: true,
    total: subscriptions.length,
    delivered: result.delivered,
    removed: result.gone.length,
    failed: result.failed.length,
  });
}

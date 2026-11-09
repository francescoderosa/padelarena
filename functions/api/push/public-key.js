import { jsonResponse, optionsResponse } from './_shared.js';

export function onRequestOptions() {
  return optionsResponse();
}

export function onRequestGet({ env }) {
  if (!env.VAPID_PUBLIC_KEY) {
    return jsonResponse({ error: 'Web Push non configurato sul server' }, 503);
  }

  return jsonResponse({ publicKey: env.VAPID_PUBLIC_KEY });
}

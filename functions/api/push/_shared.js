const ALLOWED_ORIGIN = '*';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
    'Cache-Control': 'no-store',
  };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function isValidSubscription(subscription) {
  return Boolean(
    subscription
      && typeof subscription.endpoint === 'string'
      && subscription.endpoint.startsWith('https://')
      && typeof subscription.keys?.p256dh === 'string'
      && typeof subscription.keys?.auth === 'string',
  );
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

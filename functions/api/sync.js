const ALLOWED_ORIGIN = '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, headers });
}

async function proxyToJsonBin(request, env, suffix = '') {
  const binId = env.JSONBIN_BIN_ID;
  const apiKey = env.JSONBIN_API_KEY;

  if (!binId || !apiKey) {
    return withCors(new Response('Cloud sync non configurato sul server', { status: 500 }));
  }

  const upstream = await fetch(`https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}${suffix}`, {
    method: request.method,
    headers: {
      ...(request.method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
      'X-Access-Key': apiKey,
    },
    body: request.method === 'PUT' ? request.body : undefined,
  });

  return withCors(upstream);
}

export async function onRequestOptions() {
  return withCors(new Response(null, { status: 204 }));
}

export async function onRequestGet({ request, env }) {
  return proxyToJsonBin(request, env, '/latest');
}

export async function onRequestPut({ request, env }) {
  return proxyToJsonBin(request, env);
}

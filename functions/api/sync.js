const ALLOWED_ORIGIN = '*';
const DEFAULT_CLUB_STATE_ID = 'controvetro';

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

function jsonResponse(data, status = 200) {
  return withCors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function getClubStateId(request, env) {
  if (typeof env.CLUB_STATE_ID === 'string' && env.CLUB_STATE_ID.trim()) {
    return env.CLUB_STATE_ID.trim().slice(0, 128);
  }

  try {
    return new URL(request.url).hostname || DEFAULT_CLUB_STATE_ID;
  } catch {
    return DEFAULT_CLUB_STATE_ID;
  }
}

async function readClubState(request, env) {
  if (!env.PUSH_DB) {
    return jsonResponse({ error: 'Database D1 non configurato sul server' }, 503);
  }

  const row = await env.PUSH_DB.prepare(`
    SELECT state_json, schema_version, revision, updated_at
    FROM club_state
    WHERE club_id = ?
  `).bind(getClubStateId(request, env)).first();

  if (!row) return jsonResponse({ record: null });

  let record;
  try {
    record = JSON.parse(row.state_json);
  } catch {
    return jsonResponse({ error: 'Stato D1 non valido' }, 500);
  }

  return jsonResponse({
    record: {
      ...record,
      schemaVersion: row.schema_version,
      revision: row.revision,
    },
  });
}

async function writeClubState(request, env) {
  if (!env.PUSH_DB) {
    return jsonResponse({ error: 'Database D1 non configurato sul server' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Payload JSON non valido' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Payload stato non valido' }, 400);
  }

  const state = {
    players: Array.isArray(body.players) ? body.players : [],
    matches: Array.isArray(body.matches) ? body.matches : [],
    tournaments: Array.isArray(body.tournaments) ? body.tournaments : [],
    updatedAt: Number(body.updatedAt) || Date.now(),
  };
  const now = Date.now();
  const clubStateId = getClubStateId(request, env);

  await env.PUSH_DB.prepare(`
    INSERT INTO club_state
      (club_id, state_json, schema_version, revision, updated_at)
    VALUES (?, ?, 1, 1, ?)
    ON CONFLICT(club_id) DO UPDATE SET
      state_json = excluded.state_json,
      schema_version = excluded.schema_version,
      revision = club_state.revision + 1,
      updated_at = excluded.updated_at
  `).bind(clubStateId, JSON.stringify(state), now).run();

  const row = await env.PUSH_DB.prepare(`
    SELECT revision FROM club_state WHERE club_id = ?
  `).bind(clubStateId).first();

  return jsonResponse({ ok: true, revision: row?.revision || 1 });
}

export async function onRequestOptions() {
  return withCors(new Response(null, { status: 204 }));
}

export async function onRequestGet({ request, env }) {
  try {
    return await readClubState(request, env);
  } catch (error) {
    console.error('D1 sync read error:', error);
    return jsonResponse({ error: 'Lettura D1 non riuscita' }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    return await writeClubState(request, env);
  } catch (error) {
    console.error('D1 sync write error:', error);
    return jsonResponse({ error: 'Scrittura D1 non riuscita' }, 500);
  }
}

const ALLOWED_ORIGIN = '*';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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

export function requireAdminAuth(request, env) {
  if (!env.PUSH_ADMIN_SECRET) {
    return jsonResponse({ error: 'Autenticazione amministrativa non configurata sul server' }, 503);
  }

  return request.headers.get('X-Admin-Secret') === env.PUSH_ADMIN_SECRET
    ? null
    : unauthorizedResponse();
}

export function unauthorizedResponse() {
  const response = jsonResponse({ error: 'Non autorizzato' }, 401);
  return response;
}

export function getClubStateId(request, env) {
  if (typeof env.CLUB_STATE_ID === 'string' && env.CLUB_STATE_ID.trim()) {
    return env.CLUB_STATE_ID.trim().slice(0, 128);
  }

  try {
    return new URL(request.url).hostname || 'controvetro';
  } catch {
    return 'controvetro';
  }
}

export async function readClubState(request, env) {
  if (!env.PUSH_DB) throw new Error('D1 database non configurato');

  const row = await env.PUSH_DB.prepare(`
    SELECT state_json, schema_version, revision
    FROM club_state
    WHERE club_id = ?
  `).bind(getClubStateId(request, env)).first();

  if (!row) return { state: null, revision: 0, schemaVersion: 1 };

  let state;
  try {
    state = JSON.parse(row.state_json);
  } catch {
    throw new Error('Stato D1 non valido');
  }

  return {
    state,
    revision: Number(row.revision) || 1,
    schemaVersion: Number(row.schema_version) || 1,
  };
}

export async function writeClubState(request, env, state, schemaVersion = 1) {
  const now = Date.now();
  const clubStateId = getClubStateId(request, env);
  await env.PUSH_DB.prepare(`
    INSERT INTO club_state
      (club_id, state_json, schema_version, revision, updated_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(club_id) DO UPDATE SET
      state_json = excluded.state_json,
      schema_version = excluded.schema_version,
      revision = club_state.revision + 1,
      updated_at = excluded.updated_at
  `).bind(clubStateId, JSON.stringify(state), schemaVersion, now).run();

  const row = await env.PUSH_DB.prepare(
    'SELECT revision FROM club_state WHERE club_id = ?',
  ).bind(clubStateId).first();

  return Number(row?.revision) || 1;
}

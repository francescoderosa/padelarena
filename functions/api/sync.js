const ALLOWED_ORIGIN = '*';
const DEFAULT_CLUB_STATE_ID = 'controvetro';
const RESULT_WINDOW_DAYS = 7;

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

function isResultExpired(entity) {
  if (!entity?.date || typeof entity.date !== 'string') return false;
  const [year, month, day] = entity.date.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return false;
  return Date.now() >= Date.UTC(year, month - 1, day + RESULT_WINDOW_DAYS);
}

function hasChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function findById(collection, id) {
  return Array.isArray(collection) ? collection.find(item => item?.id === id) : null;
}

function editableValue(entity) {
  return entity?.editable !== false;
}

function isTournamentLocked(tournament) {
  return Boolean(tournament && (tournament.editable === false || isResultExpired(tournament)));
}

function isMatchLocked(match, tournaments) {
  if (!match) return false;
  const tournament = findById(tournaments, match.tournamentId);
  return match.editable === false || isResultExpired(match) || isTournamentLocked(tournament);
}

function validateLockedChanges(previousState, nextState) {
  const previousTournaments = Array.isArray(previousState.tournaments) ? previousState.tournaments : [];
  const nextTournaments = Array.isArray(nextState.tournaments) ? nextState.tournaments : [];
  const previousMatches = Array.isArray(previousState.matches) ? previousState.matches : [];
  const nextMatches = Array.isArray(nextState.matches) ? nextState.matches : [];

  for (const [previousEntities, nextEntities] of [
    [previousTournaments, nextTournaments],
    [previousMatches, nextMatches],
  ]) {
    for (const entity of previousEntities) {
      const nextEntity = findById(nextEntities, entity.id);
      if (nextEntity && editableValue(entity) !== editableValue(nextEntity)) {
        return 'Il campo editable può essere modificato solo tramite API amministrative';
      }
    }
    if (nextEntities.some(entity => entity?.editable === false && !findById(previousEntities, entity.id))) {
      return 'Il campo editable può essere modificato solo tramite API amministrative';
    }
  }

  for (const tournament of previousTournaments) {
    if (!isTournamentLocked(tournament)) continue;
    const nextTournament = findById(nextTournaments, tournament.id);
    if (!nextTournament || hasChanged(tournament, nextTournament)) {
      return 'La serata non è più modificabile';
    }
  }

  for (const match of previousMatches) {
    if (!isMatchLocked(match, previousTournaments)) continue;
    const nextMatch = findById(nextMatches, match.id);
    if (!nextMatch || hasChanged(match, nextMatch)) {
      return 'La partita non è più modificabile';
    }
  }

  for (const match of nextMatches) {
    const tournament = findById(previousTournaments, match.tournamentId);
    if (isTournamentLocked(tournament) && !findById(previousMatches, match.id)) {
      return 'La serata non è più modificabile';
    }
  }

  return null;
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

  const existingRow = await env.PUSH_DB.prepare(`
    SELECT state_json FROM club_state WHERE club_id = ?
  `).bind(getClubStateId(request, env)).first();

  if (existingRow) {
    let previousState;
    try {
      previousState = JSON.parse(existingRow.state_json);
    } catch {
      return jsonResponse({ error: 'Stato D1 non valido' }, 500);
    }

    const lockError = validateLockedChanges(previousState, body);
    if (lockError) return jsonResponse({ error: lockError, code: 'MATCH_NOT_EDITABLE' }, 409);
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

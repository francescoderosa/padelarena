import {
  jsonResponse,
  optionsResponse,
  readClubState,
  requireAdminAuth,
  writeClubState,
} from '../_admin.js';

export { optionsResponse };

export function onRequestOptions() {
  return optionsResponse();
}

export async function updateEditable({ request, env, params, collection, label }) {
  const authError = requireAdminAuth(request, env);
  if (authError) return authError;

  if (!env.PUSH_DB) {
    return jsonResponse({ error: 'Database D1 non configurato sul server' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Payload JSON non valido' }, 400);
  }

  if (typeof body?.editable !== 'boolean') {
    return jsonResponse({ error: 'Il campo editable deve essere booleano' }, 400);
  }

  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) return jsonResponse({ error: `${label} non specificata` }, 400);

  try {
    const stored = await readClubState(request, env);
    if (!stored.state) return jsonResponse({ error: 'Stato del club non trovato' }, 404);

    const entities = Array.isArray(stored.state[collection]) ? stored.state[collection] : [];
    const entity = entities.find(item => item && item.id === id);
    if (!entity) return jsonResponse({ error: `${label} non trovata` }, 404);

    entity.editable = body.editable;
    stored.state.updatedAt = Date.now();
    const revision = await writeClubState(request, env, stored.state, stored.schemaVersion);

    return jsonResponse({ ok: true, editable: entity.editable, id, revision });
  } catch (error) {
    console.error(`Admin editable ${label} error:`, error);
    return jsonResponse({ error: 'Aggiornamento non riuscito' }, 500);
  }
}

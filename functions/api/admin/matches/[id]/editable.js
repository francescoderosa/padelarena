import { optionsResponse, updateEditable } from '../../_editable.js';

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPatch({ request, env, params }) {
  return updateEditable({ request, env, params, collection: 'matches', label: 'Partita' });
}

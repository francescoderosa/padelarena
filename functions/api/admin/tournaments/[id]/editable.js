import { optionsResponse, updateEditable } from '../../_editable.js';

export async function onRequestPatch({ request, env, params }) {
  return updateEditable({ request, env, params, collection: 'tournaments', label: 'Serata' });
}

export function onRequestOptions() {
  return optionsResponse();
}

const JSONBIN_API_URL = 'https://api.jsonbin.io/v3/b';

function printUsage() {
  console.log(`Uso:
  JSONBIN_BIN_ID=... JSONBIN_API_KEY=... node scripts/import-jsonbin-to-d1.mjs \
    --target https://controvetro.dev.padelmate.it/api/sync

Opzioni:
  --bin-id <id>       ID del bin JSONBin (oppure JSONBIN_BIN_ID)
  --api-key <key>     Access key JSONBin (oppure JSONBIN_API_KEY)
  --target <url>      Endpoint completo D1, incluso /api/sync
  --apply             Scrive su D1; senza questa opzione esegue solo il dry-run
  --allow-empty       Consente di importare uno stato completamente vuoto
  --help              Mostra questo messaggio
`);
}

function parseArguments(args) {
  const options = { apply: false, allowEmpty: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') {
      options.apply = true;
    } else if (argument === '--allow-empty') {
      options.allowEmpty = true;
    } else if (argument === '--help') {
      options.help = true;
    } else if (['--bin-id', '--api-key', '--target'].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Valore mancante per ${argument}`);
      }
      options[argument.slice(2).replace('-', '')] = value;
      index += 1;
    } else {
      throw new Error(`Argomento non riconosciuto: ${argument}`);
    }
  }

  return options;
}

function getState(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Il bin JSONBin non contiene un record oggetto valido');
  }

  const state = {
    players: Array.isArray(record.players) ? record.players : [],
    matches: Array.isArray(record.matches) ? record.matches : [],
    tournaments: Array.isArray(record.tournaments) ? record.tournaments : [],
    updatedAt: Number(record.updatedAt) || Date.now(),
  };

  const isEmpty = Object.entries(state)
    .filter(([key]) => key !== 'updatedAt')
    .every(([, value]) => value.length === 0);

  return { state, isEmpty };
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchJsonBin(binId, apiKey) {
  let response;
  try {
    response = await fetch(`${JSONBIN_API_URL}/${encodeURIComponent(binId)}/latest`, {
      headers: {
        Accept: 'application/json',
        'X-Access-Key': apiKey,
      },
    });
  } catch (error) {
    throw new Error(`Connessione JSONBin fallita: ${error.cause?.message || error.message}`);
  }
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(`JSONBin ha risposto HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body?.record ?? body;
}

async function writeD1(targetUrl, state) {
  let response;
  try {
    response = await fetch(targetUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch (error) {
    throw new Error(`Connessione endpoint D1 fallita: ${error.cause?.message || error.message}`);
  }
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(`Endpoint D1 ha risposto HTTP ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const binId = options.binid || process.env.JSONBIN_BIN_ID;
  const apiKey = options.apikey || process.env.JSONBIN_API_KEY;
  const targetUrl = options.target || process.env.D1_SYNC_URL;

  if (!binId) throw new Error('Specificare --bin-id o JSONBIN_BIN_ID');
  if (!apiKey) throw new Error('Specificare --api-key o JSONBIN_API_KEY');
  if (!targetUrl) throw new Error('Specificare --target o D1_SYNC_URL');

  const target = new URL(targetUrl);
  if (target.protocol !== 'https:' && target.hostname !== 'localhost' && target.hostname !== '127.0.0.1') {
    throw new Error('L\'endpoint D1 deve usare HTTPS, salvo localhost');
  }

  const record = await fetchJsonBin(binId, apiKey);
  const { state, isEmpty } = getState(record);

  console.log(`Sorgente JSONBin: ${binId}`);
  console.log(`Destinazione D1: ${target.href}`);
  console.log(`Players: ${state.players.length}`);
  console.log(`Matches: ${state.matches.length}`);
  console.log(`Tournaments: ${state.tournaments.length}`);
  console.log(`UpdatedAt: ${new Date(state.updatedAt).toISOString()}`);

  if (isEmpty && !options.allowEmpty) {
    throw new Error('Il record e\' vuoto; usare --allow-empty per consentire la sovrascrittura');
  }

  if (!options.apply) {
    console.log('Dry-run: nessuna scrittura eseguita. Aggiungere --apply per importare.');
    return;
  }

  const result = await writeD1(target.href, state);
  console.log(`Import completato: ${JSON.stringify(result)}`);
}

main().catch(error => {
  console.error(`Errore: ${error.message}`);
  process.exitCode = 1;
});

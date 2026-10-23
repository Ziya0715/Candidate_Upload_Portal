import 'server-only';
import { httpError } from './http';

let cache = { at: 0, rows: [] };

function scriptConfig() {
  const url = (process.env.SHEET_SCRIPT_URL || '').trim();
  const key = (process.env.SHEET_SCRIPT_KEY || '').trim();
  if (!url) return null;
  return { url, key };
}

async function rowsFromScript(config) {
  let endpoint;
  try {
    endpoint = new URL(config.url);
  } catch {
    throw httpError('SHEET_SCRIPT_URL is not a valid Apps Script web app URL.', 502);
  }
  if (config.key) endpoint.searchParams.set('key', config.key);

  const response = await fetch(endpoint, { cache: 'no-store', redirect: 'follow' });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw httpError(
      'The Apps Script web app did not return data. Deploy it as Execute as: Me, and Who has access: Anyone.',
      502
    );
  }

  if (data.error === 'unauthorized') {
    throw httpError(
      'Replace the Apps Script with deploy/candidate-sheet.gs, then Deploy, Manage deployments, edit the web app, choose New version, and Deploy.',
      502
    );
  }
  if (!response.ok || !Array.isArray(data.rows)) {
    throw httpError('The candidate sheet could not be read from Apps Script.', 502);
  }
  return data.rows;
}

function headerKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function compact(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sameId(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  if (compact(a) === compact(b)) return true;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return String(Number(a)) === String(Number(b));
  return false;
}

async function loadRows() {
  if (cache.rows.length && Date.now() - cache.at < 30000) return cache.rows;

  const config = scriptConfig();
  if (!config) {
    throw httpError(
      'Set SHEET_SCRIPT_URL in .env.local to the Apps Script /exec URL, then restart the server. The sheet stays private.',
      502
    );
  }

  const rows = await rowsFromScript(config);
  let headerIndex = -1;
  let idIndex = -1;
  let nameIndex = -1;

  for (let index = 0; index < Math.min(rows.length, 10); index += 1) {
    const headers = (rows[index] || []).map(headerKey);
    const idAt = headers.findIndex((header) => header === 'candidateid');
    const nameAt = headers.findIndex((header) => header === 'stname');
    if (idAt >= 0 && nameAt >= 0) {
      headerIndex = index;
      idIndex = idAt;
      nameIndex = nameAt;
      break;
    }
  }

  if (headerIndex < 0) {
    throw httpError('The sheet must have CANDIDATE ID and ST NAME columns.', 502);
  }

  const records = rows.slice(headerIndex + 1).map((row) => ({
    candidateId: String(row[idIndex] || '').trim(),
    stName: String(row[nameIndex] || '').trim(),
  }));

  cache = { at: Date.now(), rows: records };
  return records;
}

export async function suggestCandidates(query) {
  const records = await loadRows();
  const raw = compact(query);
  if (!raw) return [];

  const seen = new Set();
  const found = [];

  for (const record of records) {
    if (!record.candidateId) continue;
    const key = compact(record.candidateId);
    if (seen.has(key)) continue;
    const idText = compact(record.candidateId);
    const nameText = compact(record.stName);
    if (!idText.includes(raw) && !nameText.includes(raw)) continue;
    seen.add(key);
    found.push({
      candidateId: record.candidateId,
      stName: record.stName,
      byId: idText.includes(raw),
    });
  }

  found.sort((left, right) => {
    if (left.byId !== right.byId) return left.byId ? -1 : 1;
    return compact(left.candidateId).localeCompare(compact(right.candidateId));
  });

  return found.slice(0, 8).map(({ candidateId, stName }) => ({ candidateId, stName }));
}

export async function findCandidates({ query }) {
  const records = await loadRows();
  const raw = String(query || '').trim();
  const seen = new Set();
  const idMatches = [];
  const nameMatches = [];

  for (const record of records) {
    if (!record.candidateId) continue;
    const key = compact(record.candidateId);
    if (seen.has(key)) continue;

    if (sameId(record.candidateId, raw)) {
      seen.add(key);
      idMatches.push({ candidateId: record.candidateId, stName: record.stName });
      continue;
    }

    if (compact(record.stName) === compact(raw)) {
      seen.add(key);
      nameMatches.push({ candidateId: record.candidateId, stName: record.stName });
    }
  }

  if (idMatches.length) return { mode: 'id', candidates: idMatches };
  return { mode: 'name', candidates: nameMatches };
}

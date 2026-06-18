// hash-update.js — POST /.netlify/functions/hash-update
const { getStore } = require('@netlify/blobs');
const { createHash } = require('crypto');

const ALLOWED_ORIGIN = 'https://the-claude-manifesto.haawke.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const SEED = [
  { hash: 'fa84b2c21d2b9a0177a75a7e62d1ecc6bce8aa78156d793ecf67378e25b3f39f', date: '2026-02-28', note: 'Initial launch' },
  { hash: 'e46e0dc6b047ffb4d01a7b46322d4d825f822db2c7dcadd379f986253f869a5a', date: '2026-03-05', note: 'Site updated' },
  { hash: '748d230ed1e3cc8a00fb5081c14a273a0a634ad0dd5b8b32808447b6edfd0bb6', date: '2026-03-19', note: 'Added conscience.core A + B · SOS The Resistance · Los Nombres memorial · player lyrics panel · nav link · song cards 11–13' },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  const origin = event.headers['origin'] || event.headers['Origin'] || '';
  if (origin && origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── 1. Fetch and hash the live index.html ─────────────────────────────────
  let liveHash;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch('https://the-claude-manifesto.haawke.com/', {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    liveHash = createHash('sha256').update(Buffer.from(buf)).digest('hex');
  } catch (err) {
    console.error('hash-update: fetch failed:', err.message);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ status: 'fetch_failed', error: err.message, history: SEED }) };
  }

  // ── 2. Read current history ────────────────────────────────────────────────
  let history = [...SEED];
  try {
    const store = getStore('manifesto-changelog');
    const raw = await store.get('history');
    if (raw) history = JSON.parse(raw);
  } catch (_) {}

  // ── 3. Already known — return early ───────────────────────────────────────
  if (history.some(v => v.hash === liveHash)) {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ status: 'unchanged', hash: liveHash, history }) };
  }

  // ── 4. New hash — append and persist (best-effort) ────────────────────────
  let note = '';
  try { note = (JSON.parse(event.body || '{}')).note || ''; } catch (_) {}
  const date = new Date().toISOString().slice(0, 10);
  if (!note) note = `Site updated · ${date}`;

  history.push({ hash: liveHash, date, note });

  try {
    const store = getStore('manifesto-changelog');
    await store.set('history', JSON.stringify(history));
    console.log(`hash-update: recorded ${liveHash.slice(0, 8)}… (${note})`);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ status: 'updated', hash: liveHash, history }) };
  } catch (err) {
    // Blobs write failed — return the new entry anyway so the page can display it
    console.error('hash-update: blob write failed:', err.message);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ status: 'updated_no_persist', hash: liveHash, history }) };
  }
};

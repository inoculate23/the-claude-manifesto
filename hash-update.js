// hash-update.js — POST /.netlify/functions/hash-update
// Called by bts.html when it detects a hash not in the local history.
// Fetches the live index.html server-side, hashes with Node crypto,
// appends a new entry to the Netlify Blob store if the hash is new,
// and returns the full updated history.
//
// Body (JSON, optional):
//   { note: "Human-readable description of what changed" }
// If note is omitted, auto-generates "Site updated · YYYY-MM-DD".

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
  {
    hash: 'fa84b2c21d2b9a0177a75a7e62d1ecc6bce8aa78156d793ecf67378e25b3f39f',
    date: '2026-02-28',
    note: 'Initial launch',
  },
  {
    hash: 'e46e0dc6b047ffb4d01a7b46322d4d825f822db2c7dcadd379f986253f869a5a',
    date: '2026-03-05',
    note: 'Site updated',
  },
  {
    hash: '748d230ed1e3cc8a00fb5081c14a273a0a634ad0dd5b8b32808447b6edfd0bb6',
    date: '2026-03-19',
    note: 'Added conscience.core A + B · SOS The Resistance · Los Nombres memorial · player lyrics panel · nav link · song cards 11–13',
  },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  // Origin guard — only accept calls from the manifesto site
  const origin = event.headers['origin'] || event.headers['Origin'] || '';
  if (origin && origin !== ALLOWED_ORIGIN) {
    return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // ── 1. Fetch and hash the live index.html ──────────────────────────
    const res = await fetch('https://the-claude-manifesto.haawke.com/', {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const buf = await res.arrayBuffer();
    const liveHash = createHash('sha256').update(Buffer.from(buf)).digest('hex');

    // ── 2. Read current history from Blob store ────────────────────────
    const store = getStore('manifesto-changelog');
    let history;
    try {
      const raw = await store.get('history');
      history = raw ? JSON.parse(raw) : [...SEED];
    } catch (_) {
      history = [...SEED];
    }

    // ── 3. Check if this hash is already recorded ──────────────────────
    const alreadyKnown = history.some(v => v.hash === liveHash);
    if (alreadyKnown) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ status: 'unchanged', hash: liveHash, history }),
      };
    }

    // ── 4. New hash — append entry ─────────────────────────────────────
    let note = '';
    try {
      const body = JSON.parse(event.body || '{}');
      note = body.note || '';
    } catch (_) {}

    const date = new Date().toISOString().slice(0, 10);
    if (!note) note = `Site updated · ${date}`;

    history.push({ hash: liveHash, date, note });

    await store.set('history', JSON.stringify(history));

    console.log(`hash-update: new entry recorded — ${liveHash.slice(0, 8)}… (${note})`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'updated', hash: liveHash, history }),
    };
  } catch (err) {
    console.error('hash-update error:', err.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
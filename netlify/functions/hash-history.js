// hash-history.js — GET /.netlify/functions/hash-history
// Returns the full VERSION_HISTORY array from Netlify Blobs.
// Falls back to SEED if the store is empty (first run).

const { getStore } = require('@netlify/blobs');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://the-claude-manifesto.haawke.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

// Seed — the hardcoded history that was in bts.html before this system existed.
// Only used on first run before the blob store has been populated.
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

  try {
    const store = getStore('manifesto-changelog');
    const raw = await store.get('history');
    const history = raw ? JSON.parse(raw) : SEED;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(history),
    };
  } catch (err) {
    // Blob store unavailable (local dev, cold start issue) — return seed
    console.error('hash-history: blob read failed:', err.message);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(SEED),
    };
  }
};
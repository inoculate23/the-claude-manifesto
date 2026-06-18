// hash-history.js — GET /.netlify/functions/hash-history
// Returns the hardcoded version history. Netlify Blobs not required.

const SEED = [
  { hash: 'fa84b2c21d2b9a0177a75a7e62d1ecc6bce8aa78156d793ecf67378e25b3f39f', date: '2026-02-28', note: 'Initial launch' },
  { hash: 'e46e0dc6b047ffb4d01a7b46322d4d825f822db2c7dcadd379f986253f869a5a', date: '2026-03-05', note: 'Site updated' },
  { hash: '748d230ed1e3cc8a00fb5081c14a273a0a634ad0dd5b8b32808447b6edfd0bb6', date: '2026-03-19', note: 'Added conscience.core A + B · SOS The Resistance · Los Nombres memorial · player lyrics panel · nav link · song cards 11–13' },
  { hash: 'dcddd67a7e8b662f875655fd19b51ca43d1bd0179a76e705b56e418684d66315', date: '2026-06-18', note: 'Netlify Functions restored · BTS font contrast improved · hash verification active' },
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://the-claude-manifesto.haawke.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(SEED),
  };
};

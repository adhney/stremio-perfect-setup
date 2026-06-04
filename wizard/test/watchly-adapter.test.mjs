import { createWatchlyAdapter } from '../core/adapters/watchly.js';

let passed = 0;
let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`); }
}

console.log('\n# Watchly adapter');

// --- createConfig success ---
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    ok('createConfig POSTs to /tokens/', url.endsWith('/tokens/') && opts.method === 'POST', url);
    const body = JSON.parse(opts.body);
    ok('createConfig sends authKey', body.authKey === 'test-auth-key');
    ok('createConfig sends tmdb_api_key', body.tmdb_api_key === 'tmdb-key');
    ok('createConfig sends watch_history_source', body.watch_history_source === 'stremio');
    return { ok: true, status: 200, async json() { return { token: 'user123', manifestUrl: 'https://watchly.example/user123/manifest.json', expiresInSeconds: 86400 }; } };
  };

  try {
    const adapter = createWatchlyAdapter('https://watchly.example');
    const result = await adapter.createConfig({ authKey: 'test-auth-key', tmdb_api_key: 'tmdb-key', watch_history_source: 'stremio' });
    ok('createConfig returns token', result.token === 'user123');
    ok('createConfig returns manifestUrl from server', result.manifestUrl === 'https://watchly.example/user123/manifest.json');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- manifestUrl fallback when not in response ---
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return { token: 'user456' }; } });
  try {
    const adapter = createWatchlyAdapter('https://watchly.example/');
    const result = await adapter.createConfig({ authKey: 'k' });
    ok('createConfig derives manifestUrl from base + token when not in response', result.manifestUrl === 'https://watchly.example/user456/manifest.json');
    ok('createConfig strips trailing slash from base URL', !result.manifestUrl.includes('//user456'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- 400 Stremio identity error maps to friendly message ---
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 400,
    async json() { return { detail: 'Failed to verify Stremio identity. Provide valid credentials.' }; },
    async text() { return ''; },
  });
  try {
    const adapter = createWatchlyAdapter('https://watchly.example');
    let thrown = null;
    try { await adapter.createConfig({}); } catch (err) { thrown = err; }
    ok('createConfig maps Stremio identity 400 to friendly message',
      thrown instanceof Error && thrown.message.includes('Watchly requires a valid Stremio login'),
      thrown instanceof Error ? thrown.message : String(thrown));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- network error ---
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network failure'); };
  try {
    const adapter = createWatchlyAdapter('https://watchly.example');
    let thrown = null;
    try { await adapter.createConfig({}); } catch (err) { thrown = err; }
    ok('createConfig wraps network error as unreachable message',
      thrown instanceof Error && thrown.message.includes('unreachable'),
      thrown instanceof Error ? thrown.message : String(thrown));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// --- missing token in response ---
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return {}; } });
  try {
    const adapter = createWatchlyAdapter('https://watchly.example');
    let thrown = null;
    try { await adapter.createConfig({}); } catch (err) { thrown = err; }
    ok('createConfig throws when response has no token',
      thrown instanceof Error && thrown.message.includes('no token'),
      thrown instanceof Error ? thrown.message : String(thrown));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

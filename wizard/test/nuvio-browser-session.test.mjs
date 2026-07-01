import {
  createNuvioAdapter,
  getEmailFromNuvioToken,
  parseNuvioBrowserSession,
} from '../core/adapters/nuvio.js';

let passed = 0;
let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
}

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

const sampleJwt = makeJwt({
  email: 'user@example.com',
  sub: 'user-123',
  role: 'authenticated',
});

console.log('\n# parseNuvioBrowserSession');
{
  ok('accepts raw access_token JWT', parseNuvioBrowserSession(sampleJwt) === sampleJwt);

  const supabaseStorage = JSON.stringify({
    currentSession: { access_token: sampleJwt, refresh_token: 'refresh' },
    expiresAt: 9999999999,
  });
  ok('accepts supabase.auth.token JSON shape', parseNuvioBrowserSession(supabaseStorage) === sampleJwt);

  const flatJson = JSON.stringify({ access_token: sampleJwt });
  ok('accepts flat access_token JSON', parseNuvioBrowserSession(flatJson) === sampleJwt);

  let threw = false;
  try {
    parseNuvioBrowserSession('not-json-or-jwt');
  } catch (err) {
    threw = true;
    ok('rejects invalid input', err instanceof Error && /parse|access_token/i.test(err.message));
  }
  ok('throws on invalid input', threw);
}

console.log('\n# getEmailFromNuvioToken');
{
  ok('extracts email from JWT', getEmailFromNuvioToken(sampleJwt) === 'user@example.com');
  ok('returns null for invalid JWT', getEmailFromNuvioToken('bad.token') === null);
}

console.log('\n# validateToken');
{
  const adapter = createNuvioAdapter();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    if (String(url).includes('/rest/v1/rpc/sync_pull_profiles')) {
      return new Response(JSON.stringify([{ profile_index: 1, name: 'Profile 1' }]), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  try {
    const result = await adapter.validateToken(sampleJwt);
    ok('validateToken returns access token', result?.token === sampleJwt);
    ok('validateToken returns email from JWT', result?.email === 'user@example.com');
  } catch (err) {
    ok('validateToken does not throw', false, err instanceof Error ? err.message : String(err));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

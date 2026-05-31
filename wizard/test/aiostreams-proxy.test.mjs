import { createAioStreamsAdapter } from '../core/adapters/aiostreams.js';

const target = 'https://aiostreams.example/api/v1/user';

let passed = 0;
let failed = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
  }
}

async function capturePostedUrl(proxyBase) {
  let postedUrl = '';
  globalThis.fetch = async (url) => {
    postedUrl = String(url);
    return {
      status: 201,
      async json() {
        return { data: { uuid: 'u', encryptedPassword: 'p' } };
      },
    };
  };

  const adapter = createAioStreamsAdapter('https://aiostreams.example', { proxyBase });
  await adapter.createConfig({
    template: { config: { services: [] }, metadata: { inputs: [] } },
    inputs: {},
    services: [],
    credentials: {},
    serviceCredentials: {},
    password: 'secret',
  });
  return postedUrl;
}

console.log('\n# AIOStreams proxy URL building');

ok(
  'plain proxyBase uses raw path target',
  await capturePostedUrl('https://proxy.numb3rs.stream') === target.replace('https://aiostreams.example', 'https://proxy.numb3rs.stream/https://aiostreams.example')
);

ok(
  'query proxyBase encodes target URL',
  await capturePostedUrl('https://proxy.example/?url=') === `https://proxy.example/?url=${encodeURIComponent(target)}`
);

ok(
  'raw placeholder proxyBase injects unencoded target',
  await capturePostedUrl('https://proxy.example/{url}') === `https://proxy.example/${target}`
);

ok(
  'encoded placeholder proxyBase injects encoded target',
  await capturePostedUrl('https://proxy.example/{url_encoded}') === `https://proxy.example/${encodeURIComponent(target)}`
);

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

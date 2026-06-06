import {
  formatAioAnalyticsValue,
  shouldTrackAioField,
  toAioAnalyticsParamName,
} from '../web/src/lib/analytics-helpers.ts';

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

function eq(name, a, b) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);
}

console.log('\n# analytics helpers');

eq('debridio field maps to aio_debridio', toAioAnalyticsParamName('debridio'), 'aio_debridio');
eq('nested camelCase ids map predictably', toAioAnalyticsParamName('bitrate.bitrateCap'), 'aio_bitrate_bitrate_cap');
ok('boolean addon fields remain trackable', shouldTrackAioField({ id: 'debridio', type: 'boolean' }) === true);
ok('password fields are excluded from analytics', shouldTrackAioField({ id: 'debridioApiKey', type: 'password' }) === false);
eq('true boolean values serialize correctly', formatAioAnalyticsValue('boolean', true), 'true');
eq('false boolean values serialize correctly', formatAioAnalyticsValue('boolean', false), 'false');

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

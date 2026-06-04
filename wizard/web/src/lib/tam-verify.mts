// Verification: run templates/tam.json through the parser + engine end-to-end.
// Run: node --experimental-strip-types wizard/web/src/lib/tam-verify.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildAioSections } from './aioSections.ts';
// @ts-ignore - JS engine
import { resolveTemplate, isVisible } from '../../../core/template-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..', '..');
const tpl = JSON.parse(readFileSync(join(repoRoot, 'templates', 'tam.json'), 'utf8'));

let passed = 0, failed = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name} ${detail}`); }
};

console.log('\n# parse: sections + subsections');
const sections = buildAioSections(tpl);
ok('produces at least one page', sections.length >= 1);
const allItems = sections.flatMap((s: any) => s.items);
const subsections = allItems.filter((i: any) => i.kind === 'subsection');
ok('subsections detected', subsections.length >= 8, `got ${subsections.length}`);
const bitrate = subsections.find((s: any) => s.id === 'bitrate');
ok('bitrate subsection found', !!bitrate);
ok('bitrate advanced flag', bitrate?.advanced === true);
ok('nested header.* lives inside subsection (not a page break)',
  bitrate?.alertFields.some((a: any) => a.id === 'header.mobileBackup'));
ok('bitrate child fields present', Array.isArray(bitrate?.fieldIds) && bitrate.fieldIds.includes('bitrateCap'));

console.log('\n# conditionals: includes / xor / numeric / nested paths (no throws)');
const ctxNoSvc = { inputs: { coreFilter: ['standard', 'extended'], deviceExclude: ['4k'], bitrate: { bitrateCap: 200 } }, services: [] };
let threw = false;
for (const item of allItems) {
  const collect = item.kind === 'subsection'
    ? [item.headerField, ...item.alertFields, ...((item.headerField?.subOptions) ?? [])]
    : [];
  for (const f of collect) {
    try { isVisible(f, ctxNoSvc); } catch (e) { threw = true; console.error('   threw on', f?.id, String(e)); }
  }
}
ok('all subsection field __if evaluate without throwing', !threw);
ok('includes operator works (coreFilter includes extended)',
  isVisible({ __if: 'inputs.coreFilter includes extended' }, ctxNoSvc) === true);
ok('includes negative', isVisible({ __if: 'inputs.coreFilter includes nope' }, ctxNoSvc) === false);
ok('nested numeric path (inputs.bitrate.bitrateCap != 150)',
  isVisible({ __if: 'inputs.bitrate.bitrateCap != 150' }, ctxNoSvc) === true);

console.log('\n# resolve: default inputs (no services) -> clean config');
{
  const cfg: any = resolveTemplate(tpl, { inputs: {}, services: [], credentials: {} });
  const json = JSON.stringify(cfg);
  ok('no __if leak', !json.includes('"__if"'));
  ok('no __switch leak', !json.includes('"__switch"'));
  ok('no __value leak', !json.includes('"__value"'));
  ok('no __remove leak', !json.includes('"__remove"'));
  ok('no unresolved {{inputs', !json.includes('{{inputs'));
  ok('config is a non-empty object', cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0);
}

console.log('\n# resolve: nested + service inputs -> clean config, interpolations resolved');
{
  const cfg: any = resolveTemplate(tpl, {
    inputs: {
      coreFilter: ['extended'],
      deviceExclude: ['4k'],
      bitrate: { bitrateCap: '200', bitrateCapSoft: true },
      misc: { addonName: 'My Addon' },
    },
    services: ['torbox'],
    credentials: {},
  });
  const json = JSON.stringify(cfg);
  ok('no directive leak (nested+services)',
    !json.includes('"__if"') && !json.includes('"__switch"') && !json.includes('"__value"') && !json.includes('"__remove"'));
  ok('no unresolved {{inputs (nested+services)', !json.includes('{{inputs'));
  ok('config resolved to non-empty object (nested+services)', cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0);
  ok('nested interpolation resolved (addonName is a string)', typeof cfg.addonName === 'string' && cfg.addonName.length > 0);
}

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

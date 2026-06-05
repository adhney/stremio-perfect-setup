import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  EXCLUDED_CATALOG_IDS, DISCOVER_EMOJIS,
  deriveCategoryKey, deriveCategories, deriveDiscoverFolders,
  defaultEnabledCategories, countEnabledCatalogs, buildAioMetadataConfig,
  normalizeCategoryOrder, normalizeDiscoverFolderOrder,
} from '../core/catalog-config.js';
import { filterCollections } from '../core/nuvio-collections.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const stremioTemplate = JSON.parse(readFileSync(join(root, 'templates', 'AIOMetadata.json'), 'utf8'));
const nuvioTemplate = JSON.parse(readFileSync(join(root, 'templates', 'AIOMetadata-All.json'), 'utf8'));
const collections = JSON.parse(readFileSync(join(root, 'templates', 'Nuvio-Collections.json'), 'utf8'));
const catalogs = stremioTemplate.config.catalogs;
const categoryExceptions = ['🍥'];

let passed = 0, failed = 0;
function ok(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`); }
}

console.log('\n# EXCLUDED_CATALOG_IDS');
for (const id of ['tmdb.airing_today','tmdb.year','tmdb.language','tvmaze.schedule','tvdb.trending','tvdb.genres','tvdb.collections']) {
  ok(`${id} is excluded`, EXCLUDED_CATALOG_IDS.has(id));
}
ok('tmdb.top NOT excluded (popular catalog must remain visible)', !EXCLUDED_CATALOG_IDS.has('tmdb.top'));

console.log('\n# deriveCategoryKey');
ok('Streaming emoji', deriveCategoryKey('🎬 Netflix') === '🎬');
ok('Genres emoji', deriveCategoryKey('🎭 Action') === '🎭');
ok('Anime emoji', deriveCategoryKey('🍥 Airing Now') === '🍥');
ok('Brazilian flag → 🌍', deriveCategoryKey('🇧🇷 Brazilian') === '🌍');
ok('Korean flag → 🌍', deriveCategoryKey('🇰🇷 Korean') === '🌍');
ok('Discover emoji Trakt', deriveCategoryKey('🎯 Trakt Recommendations') === '🎯');
ok('Discover emoji Popular', deriveCategoryKey('🏆 Popular') === '🏆');
ok('tmdb.language category (🌐) is excluded-group', deriveCategoryKey('🌐 By Language') === '🌐');

console.log('\n# deriveCategories: non-discover categories derived from emoji');
const collectionOnlyCats = deriveCategories(catalogs, collections);
const cats = deriveCategories(catalogs, collections, categoryExceptions);
const keys = cats.map(c => c.key);
ok('🎬 Streaming category present', keys.includes('🎬'));
ok('🎭 Genres present', keys.includes('🎭'));
ok('🍥 Anime present as own category for wizard selection', keys.includes('🍥'));
ok('🌍 World present (flag catalogs)', keys.includes('🌍'));
ok('Discover emojis NOT in regular categories', !keys.some(k => DISCOVER_EMOJIS.has(k)));
ok('Excluded emoji groups absent (🌐)', !keys.includes('🌐'));
ok('Excluded emoji groups absent (📅)', !keys.includes('📅'));
ok('Excluded emoji groups absent (⌚)', !keys.includes('⌚'));
ok('Without exceptions, Anime stays under Genres', !collectionOnlyCats.some(c => c.key === '🍥'));
ok('🎬 count === 28', cats.find(c => c.key === '🎬')?.count === 28);
ok('🕒 Runtime count === 4', cats.find(c => c.key === '🕒')?.count === 4);

console.log('\n# normalizeCategoryOrder / normalizeDiscoverFolderOrder');
ok(
  'Stremio category order keeps Anime independent',
  JSON.stringify(normalizeCategoryOrder(['🍥', '🎬', '🎭', '🎨'], ['🎬', '🎭', '🍥', '🎨'], 'stremio'))
    === JSON.stringify(['🍥', '🎬', '🎭', '🎨'])
);
ok(
  'Nuvio category order couples Genres + Anime into one block',
  JSON.stringify(normalizeCategoryOrder(['🍥', '🎬', '🎭', '🎨'], ['🎬', '🎭', '🍥', '🎨'], 'nuvio'))
    === JSON.stringify(['🎭', '🍥', '🎬', '🎨'])
);
ok(
  'Discover folder order preserves explicit drag order',
  JSON.stringify(normalizeDiscoverFolderOrder(['⭐', '🔥', '🏆', '🎯'], ['🎯', '🏆', '🔥', '⭐']))
    === JSON.stringify(['⭐', '🔥', '🏆', '🎯'])
);

console.log('\n# deriveDiscoverFolders: discover section grouped by emoji key');
const discover = deriveDiscoverFolders(catalogs, collections, categoryExceptions);
const discoverLabels = discover.map(d => d.label);
const discoverIds = discover.map(d => d.id);
ok('Recommended folder present', discoverLabels.some(l => l.includes('Recommended')));
ok('Popular folder present', discoverLabels.some(l => l.includes('Popular')));
ok('Trending folder present', discoverLabels.some(l => l.includes('Trending')));
ok('Top Rated folder present', discoverLabels.some(l => l.includes('Top Rated')));
ok('Discover ids use emoji keys', JSON.stringify(discoverIds) === JSON.stringify(['🎯', '🏆', '🔥', '⭐']));
ok('Each discover folder has catalogIds', discover.every(d => d.catalogIds.size > 0));

console.log('\n# defaultEnabledCategories: Stremio starts from reference defaults');
const stremioDefaults = defaultEnabledCategories(catalogs, 'stremio', collections, categoryExceptions);
ok('Stremio: 🎬 Streaming enabled by default', stremioDefaults.categories.has('🎬'));
ok('Stremio: 🏰 Studios NOT enabled by default', !stremioDefaults.categories.has('🏰'));
ok('Stremio: 🌍 World NOT enabled by default', !stremioDefaults.categories.has('🌍'));

const nuvioDefaults = defaultEnabledCategories(nuvioTemplate.config.catalogs, 'nuvio', collections, categoryExceptions);
ok('Nuvio: 🏰 Studios enabled by default', nuvioDefaults.categories.has('🏰'));
ok('Nuvio: 🌍 World enabled by default', nuvioDefaults.categories.has('🌍'));
ok(
  'Nuvio: all selectable catalogs enabled by default',
  countEnabledCatalogs(
    nuvioTemplate.config.catalogs,
    nuvioDefaults.categories,
    nuvioDefaults.discoverFolderIds,
    collections,
    categoryExceptions
  ) === countEnabledCatalogs(
    nuvioTemplate.config.catalogs,
    new Set(deriveCategories(nuvioTemplate.config.catalogs, collections, categoryExceptions).map(c => c.key)),
    new Set(deriveDiscoverFolders(nuvioTemplate.config.catalogs, collections, categoryExceptions).map(d => d.id)),
    collections,
    categoryExceptions
  )
);

console.log('\n# countEnabledCatalogs: Stremio 120-catalog cap enforcement');
const allEnabledCategories = new Set(cats.map(c => c.key));
const allDiscoverIds = new Set(discover.map(d => d.id));
const totalWhenAll = countEnabledCatalogs(catalogs, allEnabledCategories, allDiscoverIds, collections, categoryExceptions);
ok('All-enabled count > 120 (Stremio would overflow)', totalWhenAll > 120);
const stremioCount = countEnabledCatalogs(
  catalogs, stremioDefaults.categories, stremioDefaults.discoverFolderIds, collections, categoryExceptions
);
ok('Stremio defaults count <= 120', stremioCount <= 120, `got ${stremioCount}`);

console.log('\n# buildAioMetadataConfig: config object ready to POST');
const cfg = buildAioMetadataConfig(stremioTemplate, {
  enabledCategories: stremioDefaults.categories,
  enabledDiscoverFolderIds: stremioDefaults.discoverFolderIds,
  collections,
  categoryExceptions,
  target: 'stremio',
  apiKeys: { tmdb: 'K', tmdbAccess: 'A', tvdb: 'V', gemini: '', rpdb: 't0-free-rpdb' },
  language: 'en-US',
});
ok('Has config.catalogs array', Array.isArray(cfg.config.catalogs));
ok('No excluded catalog IDs present and enabled', cfg.config.catalogs.every(c =>
  !EXCLUDED_CATALOG_IDS.has(c.id) || !c.enabled));
ok('Stremio: showInHome=true for enabled catalogs', cfg.config.catalogs.filter(c => c.enabled).every(c => c.showInHome === true));
ok('apiKeys.tmdb populated', cfg.config.apiKeys?.tmdb === 'K');
ok('language set', cfg.config.language === 'en-US');

const nuvioCfg = buildAioMetadataConfig(nuvioTemplate, {
  enabledCategories: nuvioDefaults.categories,
  enabledDiscoverFolderIds: nuvioDefaults.discoverFolderIds,
  collections,
  categoryExceptions,
  target: 'nuvio',
  apiKeys: { tmdb: 'K', tmdbAccess: 'A', tvdb: 'V', gemini: '', rpdb: 't0-free-rpdb' },
  language: 'en-US',
});
ok('Nuvio: showInHome=false for ALL enabled catalogs', nuvioCfg.config.catalogs.filter(c => c.enabled).every(c => c.showInHome === false));

const animeSeparatedCfg = buildAioMetadataConfig(stremioTemplate, {
  enabledCategories: new Set(['🎭']),
  enabledDiscoverFolderIds: new Set(),
  collections,
  categoryExceptions,
  target: 'stremio',
  apiKeys: { tmdb: 'K', tmdbAccess: 'A', tvdb: 'V', gemini: '', rpdb: 't0-free-rpdb' },
  language: 'en-US',
});
const animeCatalogIds = new Set(catalogs.filter(c => deriveCategoryKey(c.name) === '🍥').map(c => c.id));
ok(
  'Anime catalogs stay disabled when Genres is enabled but Anime is not selected',
  animeSeparatedCfg.config.catalogs
    .filter(c => animeCatalogIds.has(c.id))
    .every(c => c.enabled === false)
);
ok(
  'Regular genre catalogs stay enabled when Genres is selected',
  animeSeparatedCfg.config.catalogs
    .filter(c => deriveCategoryKey(c.name) === '🎭')
    .every(c => c.enabled === true)
);

const reorderedCfg = buildAioMetadataConfig(stremioTemplate, {
  enabledCategories: new Set(['🎬', '🎭', '🍥', '🎨', '🏰', '🎥', '🕒', '🌍']),
  enabledDiscoverFolderIds: new Set(['🎯', '🏆', '🔥', '⭐']),
  categoryOrder: ['🍥', '🎬', '🎭', '🎨', '🏰', '🎥', '🕒', '🌍'],
  discoverFolderOrder: ['⭐', '🔥', '🏆', '🎯'],
  collections,
  categoryExceptions,
  target: 'stremio',
  apiKeys: { tmdb: 'K', tmdbAccess: 'A', tvdb: 'V', gemini: '', rpdb: 't0-free-rpdb' },
  language: 'en-US',
});
ok(
  'AIOMetadata discover catalogs reorder within Discover while Discover stays first',
  reorderedCfg.config.catalogs.slice(0, 2).every(c => c.id === 'tmdb.top_rated')
);
ok(
  'Stremio AIOMetadata can move Anime ahead of Streaming',
  deriveCategoryKey(reorderedCfg.config.catalogs[8]?.name) === '🍥'
);

const nuvioReorderedCfg = buildAioMetadataConfig(nuvioTemplate, {
  enabledCategories: new Set(['🎬', '🎭', '🍥', '🎨', '🏰', '🎥', '🕒', '🌍']),
  enabledDiscoverFolderIds: new Set(['🎯', '🏆', '🔥', '⭐']),
  categoryOrder: ['🍥', '🎬', '🎭', '🎨', '🏰', '🎥', '🕒', '🌍'],
  discoverFolderOrder: ['⭐', '🔥', '🏆', '🎯'],
  collections,
  categoryExceptions,
  target: 'nuvio',
  apiKeys: { tmdb: 'K', tmdbAccess: 'A', tvdb: 'V', gemini: '', rpdb: 't0-free-rpdb' },
  language: 'en-US',
});
ok(
  'Nuvio AIOMetadata keeps Genres ahead of Anime even when Anime is dragged first',
  deriveCategoryKey(nuvioReorderedCfg.config.catalogs[8]?.name) === '🎭'
);

// ─── nuvio-collections tests ───────────────────────────────────────────────

console.log('\n# filterCollections: Nuvio collections filtered to enabled categories');
{
  // All enabled: all 8 groups pass through
  const allCats = new Set(['🎬','🎭','🍥','🎨','🏰','🎥','🕒','🌍']);
  const allDiscover = new Set(deriveDiscoverFolders(catalogs, collections, categoryExceptions).map(d => d.id));
  const all = filterCollections(collections, catalogs, {
    enabledCategories: allCats,
    enabledDiscoverFolderIds: allDiscover,
    categoryExceptions,
  });
  ok('All enabled: all top-level groups present', all.length === collections.length);

  // Disable Studios: Studios group should be filtered out (no folders left)
  const noStudios = new Set(['🎬','🎭','🍥','🎨','🎥','🕒','🌍']);
  const filteredStudios = filterCollections(collections, catalogs, {
    enabledCategories: noStudios,
    enabledDiscoverFolderIds: allDiscover,
    categoryExceptions,
  });
  const studioGroup = filteredStudios.find(g => g.title?.includes('Studios'));
  ok('Studios group absent when disabled', !studioGroup || studioGroup.folders.length === 0);

  // Disable Anime: Genres group stays but anime folders removed
  const noAnime = new Set(['🎬','🎭','🎨','🏰','🎥','🕒','🌍']);
  const filteredAnime = filterCollections(collections, catalogs, {
    enabledCategories: noAnime,
    enabledDiscoverFolderIds: allDiscover,
    categoryExceptions,
  });
  const genreGroup = filteredAnime.find(g => g.title?.includes('Genres'));
  ok('Genres group still present when only Anime disabled', !!genreGroup);
  // Anime folders reference catalogs with IDs that have deriveCategoryKey(name) === '🍥'
  const animeCatalogIdList = [...animeCatalogIds];
  const hasAnimeFolders = genreGroup?.folders.some(f =>
    (f.catalogSources || []).some(s => animeCatalogIdList.includes(s.catalogId))
  );
  ok('No anime folders in Genres when Anime disabled', !hasAnimeFolders);

  const reorderedCollections = filterCollections(collections, nuvioTemplate.config.catalogs, {
    enabledCategories: allCats,
    enabledDiscoverFolderIds: allDiscover,
    categoryOrder: ['🎨', '🍥', '🎬', '🎭', '🏰', '🎥', '🕒', '🌍'],
    discoverFolderOrder: ['⭐', '🔥', '🏆', '🎯'],
    categoryExceptions,
  });
  ok('Discover group stays first after reordering', reorderedCollections[0]?.id === 'collections.discover');
  ok(
    'Discover folders reorder within Discover only',
    reorderedCollections[0]?.folders?.map(f => f.id).slice(0, 2).join(',')
      === 'collections.discover.top-rated,collections.discover.trending'
  );
  ok(
    'Themes can move ahead of Streaming in Nuvio collections',
    reorderedCollections[1]?.title === '🎨 Themes'
  );

  const animeOnlyCollections = filterCollections(collections, nuvioTemplate.config.catalogs, {
    enabledCategories: new Set(['🍥']),
    enabledDiscoverFolderIds: new Set(),
    categoryOrder: ['🎬', '🍥', '🎭', '🎨', '🏰', '🎥', '🕒', '🌍'],
    discoverFolderOrder: [],
    categoryExceptions,
  });
  ok(
    'Anime-only Nuvio output still creates the Genres group',
    animeOnlyCollections[0]?.id === 'collections.genres'
  );
  ok(
    'Anime-only Nuvio output keeps only the Anime folder',
    animeOnlyCollections[0]?.folders?.length === 1 && animeOnlyCollections[0]?.folders?.[0]?.id === 'collections.genres.anime'
  );
}

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);

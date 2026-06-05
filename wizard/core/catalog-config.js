// Catalog category logic for the AIOMetadata config builder.
// Category keys are the leading emoji character of each catalog's name.
// Country flag catalogs (regional indicator pairs) all map to the key '🌍'.

// Catalog IDs that are always disabled and never shown in the wizard UI.
// Source of truth: scripts/sync-aiometadata.sh EXCLUDED_CATALOG_IDS
export const EXCLUDED_CATALOG_IDS = new Set([
  'tmdb.airing_today',
  'tmdb.year',
  'tmdb.language',
  'tvmaze.schedule',
  'tvdb.trending',
  'tvdb.genres',
  'tvdb.collections',
]);

// Emoji prefixes for the special "Discover" section (folder-granular, not category-level).
export const DISCOVER_EMOJIS = new Set(['🎯', '🏆', '🔥', '⭐']);
const DISCOVER_COLLECTION_GROUP_ID = 'collections.discover';

const DEFAULT_CATEGORY_LABELS = {
  '🎬': '🎬 Streaming',
  '🎭': '🎭 Genres',
  '🎨': '🎨 Themes',
  '🏰': '🏰 Studios',
  '🎥': '🎥 Decades',
  '🕒': '🕒 Runtime',
  '🍥': '🍥 Anime',
  '🌍': '🌍 World',
};

const DEFAULT_DISCOVER_LABELS = {
  '🎯': '🎯 Trakt Recommendations',
  '🏆': '🏆 Popular',
  '🔥': '🔥 Trending',
  '⭐': '⭐ Top Rated',
};

function isDiscoverCollectionGroup(group) {
  return group?.id === DISCOVER_COLLECTION_GROUP_ID;
}

export function buildCollectionCatalogMetadata(collections) {
  const labelByCategoryKey = { ...DEFAULT_CATEGORY_LABELS };
  const categoryByCatalogId = new Map();
  const discoverByCatalogId = new Map();

  for (const group of collections || []) {
    if (!group || typeof group !== 'object') continue;
    const groupTitle = String(group.title || '').trim();
    const groupKey = deriveCategoryKey(groupTitle);
    const discoverGroup = isDiscoverCollectionGroup(group);

    if (!discoverGroup && groupKey && groupTitle) {
      labelByCategoryKey[groupKey] = groupTitle;
    }

    for (const folder of group.folders || []) {
      const folderTitle = String(folder?.title || '').trim();
      const folderKey = String(folder?.coverEmoji || '').trim() || deriveCategoryKey(folderTitle);
      const discoverLabel = folderKey
        ? `${folderKey}${folderTitle ? ` ${folderTitle}` : ''}`.trim()
        : folderTitle;

      for (const source of folder?.catalogSources || []) {
        const catalogId = String(source?.catalogId || '').trim();
        if (!catalogId) continue;

        if (discoverGroup) {
          discoverByCatalogId.set(catalogId, {
            key: folderKey,
            label: discoverLabel || DEFAULT_DISCOVER_LABELS[folderKey] || folderKey || catalogId,
          });
        } else {
          categoryByCatalogId.set(catalogId, {
            key: groupKey,
            label: groupTitle || labelByCategoryKey[groupKey] || groupKey || catalogId,
          });
        }
      }
    }
  }

  return { labelByCategoryKey, categoryByCatalogId, discoverByCatalogId };
}

function normalizeCategoryExceptions(categoryExceptions) {
  return new Set((categoryExceptions || []).map((value) => String(value || '').trim()).filter(Boolean));
}

function normalizeOrderedKeys(orderKeys, availableKeys) {
  const normalizedAvailableKeys = (availableKeys || []).map((value) => String(value || '').trim()).filter(Boolean);
  const available = new Set(normalizedAvailableKeys);
  const seen = new Set();
  const ordered = [];

  for (const key of [...(orderKeys || []), ...normalizedAvailableKeys]) {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey || !available.has(normalizedKey) || seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    ordered.push(normalizedKey);
  }

  return ordered;
}

export function normalizeDiscoverFolderOrder(orderKeys, availableKeys) {
  return normalizeOrderedKeys(orderKeys, availableKeys);
}

export function normalizeCategoryOrder(orderKeys, availableKeys, target = 'stremio') {
  const normalized = normalizeOrderedKeys(orderKeys, availableKeys);
  if (target !== 'nuvio') return normalized;

  const linkedKeys = ['🎭', '🍥'].filter((key) => normalized.includes(key));
  if (linkedKeys.length < 2) return normalized;

  const linkedKeySet = new Set(linkedKeys);
  const firstLinkedIndex = normalized.findIndex((key) => linkedKeySet.has(key));
  const insertAt = normalized
    .slice(0, firstLinkedIndex === -1 ? normalized.length : firstLinkedIndex)
    .filter((key) => !linkedKeySet.has(key))
    .length;
  const withoutLinkedKeys = normalized.filter((key) => !linkedKeySet.has(key));

  withoutLinkedKeys.splice(insertAt, 0, ...linkedKeys);
  return withoutLinkedKeys;
}

function buildOrderIndex(orderKeys) {
  return new Map(orderKeys.map((key, index) => [key, index]));
}

export function resolveCatalogSelectionEntry(catalog, collections, categoryExceptions = []) {
  const metadata = buildCollectionCatalogMetadata(collections);
  return resolveCatalogSelectionEntryWithMetadata(catalog, metadata, normalizeCategoryExceptions(categoryExceptions));
}

function resolveCatalogSelectionEntryWithMetadata(catalog, metadata, categoryExceptions) {
  if (!catalog || EXCLUDED_CATALOG_IDS.has(catalog.id)) return null;

  const discover = metadata.discoverByCatalogId.get(catalog.id);
  if (discover) {
    return { kind: 'discover', key: discover.key, label: discover.label };
  }

  const ownKey = deriveCategoryKey(catalog.name);
  if (categoryExceptions.has(ownKey)) {
    return {
      kind: 'category',
      key: ownKey,
      label: metadata.labelByCategoryKey[ownKey] || DEFAULT_CATEGORY_LABELS[ownKey] || ownKey,
    };
  }

  const mapped = metadata.categoryByCatalogId.get(catalog.id);
  if (mapped) {
    return { kind: 'category', key: mapped.key, label: mapped.label };
  }

  if (DISCOVER_EMOJIS.has(ownKey)) {
    return {
      kind: 'discover',
      key: ownKey,
      label: catalog.name || DEFAULT_DISCOVER_LABELS[ownKey] || ownKey,
    };
  }

  return {
    kind: 'category',
    key: ownKey,
    label: metadata.labelByCategoryKey[ownKey] || DEFAULT_CATEGORY_LABELS[ownKey] || ownKey,
  };
}

/**
 * Extract the leading emoji key from a catalog name.
 * Country flags (pairs of Regional Indicator symbols U+1F1E0–U+1F1FF) → '🌍'.
 * All other leading emojis → that emoji character.
 */
export function deriveCategoryKey(name) {
  if (!name) return 'other';
  const chars = [...name]; // proper Unicode codepoint split
  // Regional indicator pair = country flag
  if (
    chars.length >= 2 &&
    chars[0].codePointAt(0) >= 0x1F1E0 && chars[0].codePointAt(0) <= 0x1F1FF &&
    chars[1].codePointAt(0) >= 0x1F1E0 && chars[1].codePointAt(0) <= 0x1F1FF
  ) return '🌍';
  return chars[0] || 'other';
}

/**
 * Build an array of regular category objects (excludes Discover emojis and excluded IDs).
 * Each entry: { key, label, count, catalogs: catalog[] }
 * Labels sourced from nuvio-collections group titles where possible.
 * @param {object[]} catalogs    AIOMetadata catalog array
 * @param {object[]} collections Nuvio-Collections.json groups array
 */
export function deriveCategories(catalogs, collections, categoryExceptions = []) {
  const metadata = buildCollectionCatalogMetadata(collections);
  const exceptions = normalizeCategoryExceptions(categoryExceptions);

  const map = new Map();
  for (const c of catalogs) {
    if (EXCLUDED_CATALOG_IDS.has(c.id)) continue;
    const selectionEntry = resolveCatalogSelectionEntryWithMetadata(c, metadata, exceptions);
    if (!selectionEntry || selectionEntry.kind !== 'category') continue;
    if (!map.has(selectionEntry.key)) {
      map.set(selectionEntry.key, { key: selectionEntry.key, label: selectionEntry.label || selectionEntry.key, catalogs: [] });
    }
    map.get(selectionEntry.key).catalogs.push(c);
  }
  return [...map.values()].map(g => ({ ...g, count: g.catalogs.length }));
}

/**
 * Build an array of discover folder objects (one per discover emoji group).
 * Each entry: { id (= emoji key), emoji, label, catalogIds: Set<string> }
 */
export function deriveDiscoverFolders(catalogs, collections = [], categoryExceptions = []) {
  const metadata = buildCollectionCatalogMetadata(collections);
  const exceptions = normalizeCategoryExceptions(categoryExceptions);
  const map = new Map();
  for (const c of catalogs) {
    if (EXCLUDED_CATALOG_IDS.has(c.id)) continue;
    const selectionEntry = resolveCatalogSelectionEntryWithMetadata(c, metadata, exceptions);
    if (!selectionEntry || selectionEntry.kind !== 'discover') continue;
    if (!map.has(selectionEntry.key)) {
      map.set(selectionEntry.key, {
        id: selectionEntry.key,
        emoji: selectionEntry.key,
        label: selectionEntry.label || c.name || DEFAULT_DISCOVER_LABELS[selectionEntry.key] || selectionEntry.key,
        catalogIds: new Set(),
      });
    }
    map.get(selectionEntry.key).catalogIds.add(c.id);
  }
  return [...map.values()];
}

/**
 * Derive the default enabled categories + discover folder IDs for a target.
 * A category is "on by default" only when ALL of its catalogs are enabled in the
 * base template. This ensures the Stremio 120-catalog cap is respected.
 * Stremio: mirrors AIOMetadata.json enabled flags (Studios/World/Anime partial → off)
 * Nuvio: mirrors AIOMetadata-All.json enabled flags (all non-excluded → all on)
 *
 * @returns {{ categories: Set<string>, discoverFolderIds: Set<string> }}
 */
export function defaultEnabledCategories(catalogs, target, collections, categoryExceptions = []) {
  const categories = new Set();
  const discoverFolderIds = new Set();
  const catObjs = deriveCategories(catalogs, collections, categoryExceptions);
  const discoverFolders = deriveDiscoverFolders(catalogs, collections, categoryExceptions);

  for (const catObj of catObjs) {
    // A category is "on by default" only if ALL of its catalogs are enabled in the template.
    // This enforces the ~120-catalog Stremio cap: partial categories (e.g. Anime 5/16)
    // are excluded from defaults even though they exist in the UI.
    const allEnabled = catObj.catalogs.length > 0 && catObj.catalogs.every(c => c.enabled);
    if (allEnabled) categories.add(catObj.key);
  }
  for (const folder of discoverFolders) {
    const allEnabled = folder.catalogIds.size > 0 && [...folder.catalogIds].every(id => {
      const c = catalogs.find(x => x.id === id);
      return c?.enabled;
    });
    if (allEnabled) discoverFolderIds.add(folder.id);
  }
  return { categories, discoverFolderIds };
}

/**
 * Count how many catalogs would be enabled given the user's category + discover selections.
 * Used to enforce the ~120-catalog Stremio limit.
 */
export function countEnabledCatalogs(catalogs, enabledCategories, enabledDiscoverFolderIds, collections = [], categoryExceptions = []) {
  const metadata = buildCollectionCatalogMetadata(collections);
  const exceptions = normalizeCategoryExceptions(categoryExceptions);
  let count = 0;
  for (const c of catalogs) {
    if (EXCLUDED_CATALOG_IDS.has(c.id)) continue;
    const selectionEntry = resolveCatalogSelectionEntryWithMetadata(c, metadata, exceptions);
    if (!selectionEntry) continue;
    if (selectionEntry.kind === 'discover') {
      // Discover: group by emoji key, not by the full catalog label.
      if (enabledDiscoverFolderIds.has(selectionEntry.key)) count++;
    } else {
      if (enabledCategories.has(selectionEntry.key)) count++;
    }
  }
  return count;
}

export function sortCatalogsForOutput(catalogs, {
  collections = [],
  categoryExceptions = [],
  categoryOrder = [],
  discoverFolderOrder = [],
  target = 'stremio',
} = {}) {
  const metadata = buildCollectionCatalogMetadata(collections);
  const exceptions = normalizeCategoryExceptions(categoryExceptions);
  const categoryIndex = buildOrderIndex(normalizeCategoryOrder(
    categoryOrder,
    deriveCategories(catalogs, collections, categoryExceptions).map((category) => category.key),
    target,
  ));
  const discoverIndex = buildOrderIndex(normalizeDiscoverFolderOrder(
    discoverFolderOrder,
    deriveDiscoverFolders(catalogs, collections, categoryExceptions).map((folder) => folder.id),
  ));

  return catalogs
    .map((catalog, originalIndex) => {
      if (EXCLUDED_CATALOG_IDS.has(catalog.id)) {
        return {
          catalog,
          originalIndex,
          sectionOrder: 2,
          groupOrder: originalIndex,
        };
      }

      const selectionEntry = resolveCatalogSelectionEntryWithMetadata(catalog, metadata, exceptions);
      if (!selectionEntry) {
        return {
          catalog,
          originalIndex,
          sectionOrder: 2,
          groupOrder: originalIndex,
        };
      }

      if (selectionEntry.kind === 'discover') {
        return {
          catalog,
          originalIndex,
          sectionOrder: 0,
          groupOrder: discoverIndex.get(selectionEntry.key) ?? Number.MAX_SAFE_INTEGER,
        };
      }

      return {
        catalog,
        originalIndex,
        sectionOrder: 1,
        groupOrder: categoryIndex.get(selectionEntry.key) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((left, right) => (
      left.sectionOrder - right.sectionOrder
      || left.groupOrder - right.groupOrder
      || left.originalIndex - right.originalIndex
    ))
    .map(({ catalog }) => catalog);
}

/**
 * Build the final AIOMetadata config object from the base template + user selections.
 * Ready to POST to /api/config/save.
 *
 * @param {object} baseTemplate  Parsed AIOMetadata.json or AIOMetadata-All.json
 * @param {object} opts
 * @param {Set<string>} opts.enabledCategories       emoji keys
 * @param {Set<string>} opts.enabledDiscoverFolderIds discover emoji keys
 * @param {string[]} opts.categoryOrder              ordered category keys
 * @param {string[]} opts.discoverFolderOrder        ordered discover keys
 * @param {'stremio'|'nuvio'} opts.target
 * @param {object} opts.apiKeys  { tmdb, tmdbAccess, tvdb, gemini, rpdb }
 * @param {string} opts.language e.g. 'en-US'
 */
export function buildAioMetadataConfig(baseTemplate, {
  enabledCategories,
  enabledDiscoverFolderIds,
  categoryOrder = [],
  discoverFolderOrder = [],
  target,
  apiKeys,
  language,
  collections = [],
  categoryExceptions = [],
}) {
  const showInHome = target === 'stremio'; // Stremio: true; Nuvio: false (shown via collections)
  const metadata = buildCollectionCatalogMetadata(collections);
  const exceptions = normalizeCategoryExceptions(categoryExceptions);

  const configuredCatalogs = baseTemplate.config.catalogs.map(c => {
    if (EXCLUDED_CATALOG_IDS.has(c.id)) return { ...c, enabled: false, showInHome: false };
    const selectionEntry = resolveCatalogSelectionEntryWithMetadata(c, metadata, exceptions);
    const enabled = selectionEntry?.kind === 'discover'
      ? enabledDiscoverFolderIds.has(selectionEntry.key)
      : enabledCategories.has(selectionEntry?.key);
    return { ...c, enabled, showInHome: enabled ? showInHome : false };
  });
  const catalogs = sortCatalogsForOutput(configuredCatalogs, {
    collections,
    categoryExceptions,
    categoryOrder,
    discoverFolderOrder,
    target,
  });

  const config = {
    ...baseTemplate.config,
    language,
    catalogs,
    apiKeys: {
      ...(baseTemplate.config.apiKeys || {}),
      tmdb: apiKeys.tmdb || '',
      tmdbAccessToken: apiKeys.tmdbAccess || '',
      tvdb: apiKeys.tvdb || '',
      gemini: apiKeys.gemini || '',
      rpdb: apiKeys.rpdb || 't0-free-rpdb',
    },
  };

  return { config };
}

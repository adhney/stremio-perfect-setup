// Filter a Nuvio-Collections.json array to only include groups/folders
// whose content belongs to the user's enabled catalog categories.
// Emoji exceptions such as Anime can be split into separate wizard categories
// while remaining nested under their original collections group.

import { resolveCatalogSelectionEntry } from './catalog-config.js';

/**
 * Determine whether a Nuvio folder's content belongs to an enabled category.
 * A folder is kept if ANY of its catalogSources maps to an enabled category.
 */
function isFolderEnabled(folder, catalogById, collections, categoryExceptions, enabledCategories, enabledDiscoverFolderIds) {
  const sources = folder.catalogSources || [];
  if (sources.length === 0) return true; // no catalog sources; keep

  for (const src of sources) {
    if (!src.catalogId) continue;
    const catalog = catalogById.get(src.catalogId);
    if (!catalog) continue;

    const selectionEntry = resolveCatalogSelectionEntry(catalog, collections, categoryExceptions);
    if (!selectionEntry) continue;

    if (selectionEntry.kind === 'discover' && enabledDiscoverFolderIds.has(selectionEntry.key)) return true;
    if (selectionEntry.kind === 'category' && enabledCategories.has(selectionEntry.key)) return true;
  }
  return false;
}

/**
 * Filter a collections JSON array to match the user's enabled categories.
 * Groups with no remaining folders are removed entirely.
 *
 * @param {object[]} collections              Nuvio-Collections.json top-level array
 * @param {object[]} catalogs                 AIOMetadata catalog array (for id→name lookup)
 * @param {object}   opts
 * @param {Set}      opts.enabledCategories
 * @param {Set}      opts.enabledDiscoverFolderIds
 * @param {string[]}   opts.categoryExceptions
 * @returns {object[]} filtered collections array
 */
export function filterCollections(collections, catalogs, {
  enabledCategories,
  enabledDiscoverFolderIds,
  categoryExceptions = [],
}) {
  const catalogById = new Map(catalogs.map((catalog) => [catalog.id, catalog]));
  const result = [];

  for (const group of collections) {
    const filteredFolders = (group.folders || []).filter(folder =>
      isFolderEnabled(folder, catalogById, collections, categoryExceptions, enabledCategories, enabledDiscoverFolderIds)
    );
    if (filteredFolders.length > 0) {
      result.push({ ...group, folders: filteredFolders });
    }
  }
  return result;
}

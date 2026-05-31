function resolveGuideRoot(): URL {
  return new URL('../', window.location.href);
}

export function getGuideUrl(): string {
  return resolveGuideRoot().toString();
}

export function getGuideAccountsUrl(): string {
  return new URL('guide/1-Accounts', resolveGuideRoot()).toString();
}

export function getGuideStatsUrl(): string {
  return new URL('assets/data/guide-stats.json', resolveGuideRoot()).toString();
}

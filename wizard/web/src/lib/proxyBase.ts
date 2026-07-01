import type { WizardConfig } from './constants.ts';

function isNumb3rsHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'numb3rs.stream' || host.endsWith('.numb3rs.stream');
}

function isGitHubPagesHost(hostname: string) {
  return hostname.toLowerCase().endsWith('.github.io');
}

/** Pick the CORS proxy base URL for browser-side AIOStreams API calls. */
export function resolveProxyBase(config: WizardConfig | null): string {
  const configured = config?.proxyBase?.trim() ?? '';
  if (typeof window === 'undefined') return configured;

  if (isNumb3rsHost(window.location.hostname)) {
    return configured;
  }

  const pagesProxy = config?.githubPagesProxyBase?.trim() ?? '';
  if (isGitHubPagesHost(window.location.hostname)) {
    if (pagesProxy) return pagesProxy;
    return configured;
  }

  return configured;
}

/** Validate that GitHub Pages has a server-side CORS proxy configured. */
export function assertProxyConfigured(config: WizardConfig | null): void {
  if (typeof window === 'undefined') return;
  if (!isGitHubPagesHost(window.location.hostname)) return;

  const pagesProxy = config?.githubPagesProxyBase?.trim() ?? '';
  if (pagesProxy) return;

  throw new Error(
    '[CORS_PROXY] This GitHub Pages wizard needs a server-side CORS proxy for AIOStreams.\n\n' +
    'Browsers cannot POST to AIOStreams directly from github.io, and the in-browser service worker proxy cannot work around that.\n\n' +
    'Your options:\n' +
    '  • Use the hosted wizard at https://numb3rs.stream/wizard/ (recommended)\n' +
    '  • Deploy the included Cloudflare Worker from hosting/apps/proxy/ and set "githubPagesProxyBase" in wizard/config.json\n' +
    '  • Ask the owner of https://proxy.numb3rs.stream to allow your github.io origin'
  );
}

/** Kept for compatibility with earlier builds; no-op now that SW proxy was removed. */
export async function ensureCorsProxyReady(): Promise<void> {
  return;
}

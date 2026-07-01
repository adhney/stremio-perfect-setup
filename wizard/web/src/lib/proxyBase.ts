import type { WizardConfig } from './constants.ts';

function isNumb3rsHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'numb3rs.stream' || host.endsWith('.numb3rs.stream');
}

/** Pick the CORS proxy base URL for browser-side AIOStreams API calls. */
export function resolveProxyBase(config: WizardConfig | null): string {
  const configured = config?.proxyBase?.trim() ?? '';
  if (typeof window === 'undefined') return configured;

  // Upstream numb3rs.stream uses the hosted proxy with an origin allowlist.
  if (isNumb3rsHost(window.location.hostname)) {
    return configured;
  }

  // GitHub Pages / local static builds use the wizard's same-origin service worker proxy.
  if ('serviceWorker' in navigator) {
    return new URL('cors-proxy/', window.location.href).href.replace(/\/$/, '');
  }

  return configured;
}

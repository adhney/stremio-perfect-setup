import type { WizardConfig } from './constants.ts';

function isNumb3rsHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'numb3rs.stream' || host.endsWith('.numb3rs.stream');
}

export function usesBuiltInCorsProxy() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  return !isNumb3rsHost(window.location.hostname);
}

/** Pick the CORS proxy base URL for browser-side AIOStreams API calls. */
export function resolveProxyBase(config: WizardConfig | null): string {
  const configured = config?.proxyBase?.trim() ?? '';
  if (typeof window === 'undefined') return configured;

  if (isNumb3rsHost(window.location.hostname)) {
    return configured;
  }

  if (usesBuiltInCorsProxy()) {
    return new URL('cors-proxy/', window.location.href).href.replace(/\/$/, '');
  }

  return configured;
}

/** Register and activate the wizard CORS proxy service worker before API calls. */
export async function ensureCorsProxyReady(): Promise<void> {
  if (!usesBuiltInCorsProxy()) return;

  const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });

  if (navigator.serviceWorker.controller) {
    await navigator.serviceWorker.ready;
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => resolve(), 8000);
    const finish = () => {
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange', finish);

    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    registration.installing?.addEventListener('statechange', () => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });

  await navigator.serviceWorker.ready;
}

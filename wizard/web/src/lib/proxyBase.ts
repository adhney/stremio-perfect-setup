import type { WizardConfig } from './constants.ts';

const RELOAD_KEY = 'wizard-cors-proxy-reload';

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
    // Query-style proxy avoids embedding https:// in the path and works with buildUrl's ?url= mode.
    return new URL('cors-proxy?url=', window.location.href).href;
  }

  return configured;
}

export function isCorsProxyControlling() {
  return usesBuiltInCorsProxy() && Boolean(navigator.serviceWorker.controller);
}

/** Register and activate the wizard CORS proxy service worker before API calls. */
export async function ensureCorsProxyReady(): Promise<void> {
  if (!usesBuiltInCorsProxy()) return;

  if (navigator.serviceWorker.controller) {
    await navigator.serviceWorker.ready;
    sessionStorage.removeItem(RELOAD_KEY);
    return;
  }

  const registration = await navigator.serviceWorker.register('./sw.js', {
    scope: './',
    updateViaCache: 'none',
  });

  await new Promise<void>((resolve) => {
    if (navigator.serviceWorker.controller) {
      resolve();
      return;
    }

    const timeout = window.setTimeout(() => resolve(), 5000);
    const finish = () => {
      if (!navigator.serviceWorker.controller) return;
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', finish);
      resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange', finish);

    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    registration.installing?.addEventListener('statechange', () => {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
  });

  await navigator.serviceWorker.ready;

  if (navigator.serviceWorker.controller) {
    sessionStorage.removeItem(RELOAD_KEY);
    return;
  }

  if (!sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, '1');
    window.location.reload();
    await new Promise(() => {});
  }

  throw new Error(
    '[CORS_PROXY] The wizard CORS proxy could not start in your browser. ' +
    'Reload this page, wait a few seconds, then run setup again. ' +
    'If it still fails, use https://numb3rs.stream/wizard/ instead.'
  );
}

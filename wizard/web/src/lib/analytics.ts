import type { AioSection } from './aioSections';

const MEASUREMENT_ID = (typeof __GUIDE_GA4_ID__ === 'string' ? __GUIDE_GA4_ID__ : '').trim();

const COMPLETION_EVENT = 'wizard_setup_completed';
const ACCOUNT_CREATED_EVENT = 'wizard_account_created';

let analyticsReady = false;

interface StepMeta {
  index: number;
  slug: string;
  name: string;
}

interface CompletionPayload {
  accountMode: 'create' | 'signin';
  addonCount: number;
  debridServiceCount: number;
  runId: string;
  target: 'stremio' | 'nuvio';
}

export function ensureAnalytics() {
  if (analyticsReady || !MEASUREMENT_ID || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  const scriptId = 'wizard-ga4';
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });

  analyticsReady = true;
}

export function trackWizardStepView(
  step: number,
  target: 'stremio' | 'nuvio' | null,
  aioSections: AioSection[],
) {
  if (!MEASUREMENT_ID) return;

  ensureAnalytics();

  const meta = getStepMeta(step, aioSections);
  if (!meta || typeof window.gtag !== 'function') return;

  const baseUrl = new URL('./', window.location.href);
  const pageLocation = new URL(meta.slug, baseUrl).toString();
  const pagePath = `${baseUrl.pathname.replace(/\/$/, '')}/${meta.slug}`;

  window.gtag('event', 'page_view', {
    page_location: pageLocation,
    page_path: pagePath,
    page_title: `Perfect Setup Wizard - ${meta.name}`,
  });

  window.gtag('event', 'wizard_step_view', {
    step_index: meta.index,
    step_name: meta.name,
    step_slug: meta.slug,
    target: target ?? 'unknown',
  });
}

export function trackWizardCompletion(payload: CompletionPayload) {
  if (!MEASUREMENT_ID) return;

  ensureAnalytics();

  if (typeof window.gtag !== 'function') return;

  const completionStorageKey = `wizard-completion-sent:${payload.runId}`;
  if (readSessionFlag(completionStorageKey)) return;

  window.gtag('event', COMPLETION_EVENT, {
    account_mode: payload.accountMode,
    addon_count: payload.addonCount,
    debrid_service_count: payload.debridServiceCount,
    target: payload.target,
  });
  writeSessionFlag(completionStorageKey);

  if (payload.accountMode !== 'create') return;

  const createdStorageKey = `wizard-account-created-sent:${payload.runId}`;
  if (readSessionFlag(createdStorageKey)) return;

  window.gtag('event', ACCOUNT_CREATED_EVENT, {
    addon_count: payload.addonCount,
    debrid_service_count: payload.debridServiceCount,
    target: payload.target,
  });
  writeSessionFlag(createdStorageKey);
}

export function getStepMeta(step: number, aioSections: AioSection[]): StepMeta | null {
  if (step === 0) return { index: 0, slug: 'welcome', name: 'Welcome' };
  if (step === 1) return { index: 1, slug: 'account', name: 'Account Setup' };
  if (step === 2) return { index: 2, slug: 'debrid-service', name: 'Debrid Service' };
  if (step === 3) return { index: 3, slug: 'tmdb-keys', name: 'TMDB API Keys' };
  if (step === 4) return { index: 4, slug: 'tvdb-key', name: 'TVDB API Key' };
  if (step === 5) return { index: 5, slug: 'gemini-key', name: 'Gemini AI Key' };
  if (step === 6) return { index: 6, slug: 'rpdb-key', name: 'RPDB Poster Ratings' };

  const sectionIndex = step - 7;
  if (sectionIndex >= 0 && sectionIndex < aioSections.length) {
    const section = aioSections[sectionIndex];
    return {
      index: step,
      slug: sanitizeSlug(section.title || section.id || `section-${step}`),
      name: `${section.icon ? `${section.icon} ` : ''}${section.title}`.trim(),
    };
  }

  if (step === 7 + aioSections.length) {
    return { index: step, slug: 'catalogs', name: 'Catalogs' };
  }
  if (step === 8 + aioSections.length) {
    return { index: step, slug: 'install', name: 'Install' };
  }
  if (step === 9 + aioSections.length) {
    return { index: step, slug: 'done', name: 'Done' };
  }

  return null;
}

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'step';
}

function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Ignore storage failures; analytics should remain best-effort.
  }
}

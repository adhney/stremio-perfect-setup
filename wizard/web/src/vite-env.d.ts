/// <reference types="vite/client" />

declare global {
  const __GUIDE_GA4_ID__: string;

  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export {};

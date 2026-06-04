// Watchly adapter: submits a config to a Watchly instance and returns the manifest URL.
// API: POST /tokens/ with TokenRequest body → { token, manifestUrl, expiresInSeconds }
// The token equals the Stremio user_id; manifest URL is deterministic: {HOST}/{token}/manifest.json
// Stremio identity (authKey or email+password) is REQUIRED by the server even when using Trakt
// as the watch history source, because the user_id is the storage key.
//
// NOTE: Watchly Trakt/Simkl-as-source is not yet supported by this wizard (v1 = stremio source only).
// Blocked on Watchly's OAuth postMessage targetOrigin being pinned to Watchly's own origin.
// When the maintainer adds a validated return_origin, add trakt_access_token/trakt_refresh_token/
// trakt_token_expires_at to the body and update watch_history_source accordingly.

function normalizeBase(url) {
  return url.replace(/\/+$/, '');
}

export function createWatchlyAdapter(instanceUrl) {
  if (!instanceUrl) throw new Error('createWatchlyAdapter: instanceUrl is required');
  const base = normalizeBase(instanceUrl);
  return {
    base,

    /**
     * Submit the full TokenRequest body to Watchly and return { token, manifestUrl }.
     * @param {object} body  Merged Watchly.json defaults + injected identity/keys.
     */
    async createConfig(body) {
      let res;
      try {
        res = await fetch(`${base}/tokens/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new Error(`Watchly at ${base} is unreachable: ${err?.message || err}. Check your internet connection or try again shortly.`);
      }

      if (!res.ok) {
        let detail = '';
        try { detail = (await res.json())?.detail || ''; } catch { /* ignore */ }
        if (!detail) detail = await res.text().catch(() => '');
        if (res.status === 400 && /stremio identity|stremio/i.test(String(detail))) {
          throw new Error('Watchly requires a valid Stremio login to set up. Please check the Stremio credentials on the Watchly page and try again.');
        }
        throw new Error(
          `Watchly at ${base} rejected the configuration (HTTP ${res.status}).` +
          (detail ? ` Server said: ${String(detail).slice(0, 300)}` : '')
        );
      }

      const responseBody = await res.json();
      const token = responseBody.token;
      if (!token) throw new Error(`Watchly at ${base}: no token in the server response, the save may have failed silently.`);
      const manifestUrl = responseBody.manifestUrl ?? `${base}/${token}/manifest.json`;
      return { token, manifestUrl };
    },

    /** Health probe — checks the base manifest endpoint. */
    async health() {
      const res = await fetch(`${base}/manifest.json`).catch(() => null);
      return Boolean(res && res.ok);
    },
  };
}

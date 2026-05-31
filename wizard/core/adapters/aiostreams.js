// AIOStreams adapter: creates a stored user config on an instance and returns the manifest URL.
// Contract confirmed from Viren070/AIOStreams
// (see docs/superpowers/plans/API-NOTES.md §2).
//
// CORS note: all known community instances respond to OPTIONS /api/v1/user without
// Access-Control-Allow-Origin headers, causing browsers to block the preflight.
// The adapter supports an optional `proxyBase` parameter which, when set, prefixes
// the API URL so requests are relayed through a CORS-capable proxy
// (e.g. "https://proxy.numb3rs.stream" or a self-hosted worker).

import { resolveTemplate } from '../template-engine.js';

const API_VERSION = 'v1';

function normalizeBase(instanceUrl) {
  return instanceUrl.replace(/\/+$/, '');
}

/**
 * Build the final fetch URL, optionally routing through a CORS proxy.
 * proxyBase examples:
 *   ""                               → direct request (may fail due to CORS)
 *   "https://proxy.numb3rs.stream"   → append the raw target URL as a path
 *   "https://proxy.example/?url="    → append the encoded target URL as a query value
 *   "https://proxy.example/{url}"    → replace placeholder with the raw target URL
 *   "https://proxy.example/{url_encoded}" → replace placeholder with the encoded target URL
 */
function buildUrl(targetUrl, proxyBase) {
  if (!proxyBase) return targetUrl;
  const trimmed = proxyBase.replace(/\/+$/, '');
  if (trimmed.includes('{url_encoded}')) {
    return trimmed.replace('{url_encoded}', encodeURIComponent(targetUrl));
  }
  if (trimmed.includes('{url}')) {
    return trimmed.replace('{url}', targetUrl);
  }
  // Query-style proxies usually expect the target as an encoded value.
  if (trimmed.includes('?') || trimmed.endsWith('=')) {
    return trimmed + encodeURIComponent(targetUrl);
  }
  // Path-style proxies expect the raw target URL after the slash:
  // https://proxy.example/https://upstream.example/path
  return trimmed + '/' + targetUrl;
}

export function createAioStreamsAdapter(instanceUrl, { proxyBase = '' } = {}) {
  const base = normalizeBase(instanceUrl);
  return {
    base,
    /**
     * Resolve the repo template with the user's inputs + credentials, store it, return identifiers.
     * @returns {Promise<{uuid, encryptedPassword, manifestUrl, password}>}
     */
    async createConfig({ template, inputs, services, credentials, serviceCredentials, password, addonPassword, configOverride }) {
      let config = resolveTemplate(template, { inputs, services, credentials, serviceCredentials });
      // configOverride allows shallow-merging top-level keys after resolution (e.g. disabling TMDB features in tests).
      if (configOverride && typeof configOverride === 'object') {
        config = { ...config, ...configOverride };
      }
      const headers = { 'content-type': 'application/json' };
      if (addonPassword) headers['x-aiostreams-addon-password'] = addonPassword;

      const apiUrl = buildUrl(`${base}/api/${API_VERSION}/user`, proxyBase);

      let res;
      try {
        res = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ config, password }),
        });
      } catch (err) {
        const message = String(err?.message || err);
        const isCors = /Failed to fetch|NetworkError|Load failed|CORS/i.test(message);
        if (isCors) {
          throw new Error(
            `[CORS] AIOStreams at ${base} is unreachable from your browser, this is a CORS issue. ` +
            `The instance is online and reachable, but its server does not send the ` +
            `Access-Control-Allow-Origin header required for browser requests. ` +
            `To work around this, set a CORS proxy URL in config.json under "proxyBase" ` +
            `(e.g. "https://proxy.numb3rs.stream") and rebuild the wizard.`
          );
        }
        throw new Error(`AIOStreams ${base}: network error: ${message}`);
      }
      if (res.status !== 201) {
        let detail = '';
        try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
        if (!detail) detail = await res.text().catch(() => '');
        throw new Error(
          `AIOStreams ${base}: configuration rejected by the server (HTTP ${res.status}).` +
          (detail ? ` Details: ${detail.slice(0, 300)}` : '')
        );
      }
      const body = await res.json();
      const data = body.data || body;
      const { uuid, encryptedPassword } = data;
      if (!uuid || !encryptedPassword) throw new Error(`AIOStreams ${base}: server returned an incomplete response (missing uuid or encryptedPassword)`);
      return {
        uuid,
        encryptedPassword,
        password,
        manifestUrl: `${base}/stremio/${uuid}/${encryptedPassword}/manifest.json`,
      };
    },

    /** Verify an instance is reachable + lists templates (health probe). */
    async health() {
      const res = await fetch(`${base}/api/${API_VERSION}/health`).catch(() => null);
      return Boolean(res && res.ok);
    },
  };
}

// Create the same config across multiple instances in order (AIOManager-style redundancy).
// params may include `proxyBase` for CORS proxy support and `_postResolveOverride` to patch
// the resolved config before POSTing (useful for testing without a TMDB key).
export async function createWithFallbacks(instances, params) {
  const { proxyBase, _postResolveOverride, ...createParams } = params;
  const configOverride = _postResolveOverride || undefined;
  const results = [];
  for (const instanceUrl of instances) {
    try {
      const adapter = createAioStreamsAdapter(instanceUrl, { proxyBase });
      results.push({ instanceUrl, ok: true, ...(await adapter.createConfig({ ...createParams, configOverride })) });
    } catch (err) {
      results.push({ instanceUrl, ok: false, error: String(err.message || err) });
    }
  }
  const primary = results.find((r) => r.ok);
  if (!primary) {
    const allCors = results.every((r) => r.error?.includes('[CORS]'));
    const errors = results.map((r) => r.error?.replace('[CORS] ', '')).join('\n\n');
    if (allCors) {
      throw new Error(
        `[CORS_ALL] Unable to create your AIOStreams configuration, all ${results.length} instance${results.length !== 1 ? 's' : ''} ` +
        `blocked the browser request due to missing CORS headers.\n\n` +
        `This is a server-side configuration issue on the AIOStreams instances, not a problem with your setup. ` +
        `Your options are:\n` +
        `  • Ask the instance owner to enable CORS on their server.\n` +
        `  • Set "proxyBase" in config.json to route through a CORS proxy ` +
        `(e.g. "https://proxy.numb3rs.stream") and rebuild.\n` +
        `  • Use the AIOStreams web interface directly at the instance URL and paste your manifest URL into the wizard.`
      );
    }
    throw new Error(`All AIOStreams instances failed:\n\n${errors}`);
  }
  return { primary, all: results };
}

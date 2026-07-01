const ALLOWED_TARGET_SUFFIXES = [
  '.midnightignite.me',
  '.fortheweak.cloud',
  '.viren070.me',
  '.elfhosted.com',
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function corsProxyPathname() {
  return new URL('cors-proxy', self.registration.scope).pathname.replace(/\/$/, '');
}

function isAllowedTarget(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_TARGET_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  const requested = request.headers.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': requested || 'Authorization, Content-Type, X-Requested-With, x-aiostreams-addon-password',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin, Access-Control-Request-Headers',
  };
}

function parseProxyTarget(requestUrl) {
  const proxyPath = corsProxyPathname();
  if (requestUrl.pathname !== proxyPath && requestUrl.pathname !== `${proxyPath}/`) {
    const pathPrefix = `${proxyPath}/`;
    if (!requestUrl.pathname.startsWith(pathPrefix)) return null;
    return requestUrl.pathname.slice(pathPrefix.length) + requestUrl.search;
  }

  const fromQuery = requestUrl.searchParams.get('url');
  if (fromQuery) return fromQuery;

  const pathPrefix = `${proxyPath}/`;
  if (requestUrl.pathname.startsWith(pathPrefix)) {
    return requestUrl.pathname.slice(pathPrefix.length) + requestUrl.search;
  }

  return null;
}

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const targetUrl = parseProxyTarget(requestUrl);
  if (!targetUrl) return;

  if (!targetUrl.startsWith('https://')) {
    event.respondWith(new Response(JSON.stringify({ error: 'Invalid cors-proxy target URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(event.request) },
    }));
    return;
  }

  if (!isAllowedTarget(targetUrl)) {
    event.respondWith(new Response(JSON.stringify({ error: 'Target host not allowed', targetUrl }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(event.request) },
    }));
    return;
  }

  if (event.request.method === 'OPTIONS') {
    event.respondWith(new Response(null, { status: 204, headers: corsHeaders(event.request) }));
    return;
  }

  event.respondWith((async () => {
    try {
      const upstreamHeaders = new Headers(event.request.headers);
      upstreamHeaders.delete('origin');
      upstreamHeaders.delete('referer');

      let body;
      if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
        const buffered = await event.request.clone().arrayBuffer();
        body = buffered.byteLength > 0 ? buffered : undefined;
        if (body) {
          upstreamHeaders.set('content-length', String(body.byteLength));
        } else {
          upstreamHeaders.delete('content-length');
        }
      }

      const upstream = await fetch(targetUrl, {
        method: event.request.method,
        headers: upstreamHeaders,
        body,
        redirect: 'follow',
      });

      const responseHeaders = new Headers(upstream.headers);
      for (const [key, value] of Object.entries(corsHeaders(event.request))) {
        responseHeaders.set(key, value);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Upstream request failed',
        message: String(err?.message || err),
        targetUrl,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(event.request) },
      });
    }
  })());
});

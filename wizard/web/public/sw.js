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

function corsProxyPrefix() {
  return new URL('cors-proxy/', self.registration.scope).pathname;
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

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const prefix = corsProxyPrefix();
  if (!requestUrl.pathname.startsWith(prefix)) return;

  const targetUrl = requestUrl.pathname.slice(prefix.length) + requestUrl.search;
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
    const upstreamHeaders = new Headers(event.request.headers);
    upstreamHeaders.delete('origin');
    upstreamHeaders.delete('referer');

    const upstream = await fetch(targetUrl, {
      method: event.request.method,
      headers: upstreamHeaders,
      body: event.request.method === 'GET' || event.request.method === 'HEAD' ? undefined : event.request.body,
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
  })());
});

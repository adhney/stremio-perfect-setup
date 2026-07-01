const DEFAULT_ALLOWED_ORIGINS = [
  'https://numb3rs.stream',
  'https://*.numb3rs.stream',
  'https://*.github.io',
];

const DEFAULT_ALLOWED_TARGET_HOSTS = [
  '.midnightignite.me',
  '.fortheweak.cloud',
  '.viren070.me',
  '.elfhosted.com',
];

const ALLOWED_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';

function parseCsv(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isHostPatternMatch(hostName, allowedHost) {
  const host = hostName.toLowerCase();
  const pattern = allowedHost.toLowerCase();
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return host === pattern.slice(2) || host.endsWith(suffix);
  }
  if (pattern.startsWith('.')) {
    return host.endsWith(pattern);
  }
  return host === pattern;
}

function parseOriginPattern(originPattern) {
  const match = originPattern.match(/^([a-z][a-z0-9+.-]*):\/\/([^/]+)$/i);
  if (!match) return null;
  const [, protocol, hostPort] = match;
  const lastColonIndex = hostPort.lastIndexOf(':');
  const hasPort = lastColonIndex !== -1 && !hostPort.endsWith(']');
  const hostName = hasPort ? hostPort.slice(0, lastColonIndex) : hostPort;
  const port = hasPort ? hostPort.slice(lastColonIndex + 1) : '';
  return {
    protocol: protocol.toLowerCase(),
    hostName: hostName.toLowerCase(),
    port,
  };
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin.toLowerCase());
  } catch {
    return false;
  }

  return allowedOrigins.some((allowedOrigin) => {
    if (!allowedOrigin.includes('*') && !allowedOrigin.includes('://.')) {
      return parsedOrigin.origin === allowedOrigin;
    }
    const parsedPattern = parseOriginPattern(allowedOrigin);
    if (!parsedPattern) return false;
    return parsedOrigin.protocol === `${parsedPattern.protocol}:`
      && parsedOrigin.port === parsedPattern.port
      && isHostPatternMatch(parsedOrigin.hostname, parsedPattern.hostName);
  });
}

function isTargetHostAllowed(hostName, allowedTargetHosts) {
  if (!hostName) return false;
  return allowedTargetHosts.some((allowedHost) => isHostPatternMatch(hostName, allowedHost));
}

function corsHeaders(origin, requestedHeaders) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': requestedHeaders || 'Authorization, Content-Type, X-Requested-With, x-aiostreams-addon-password',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin, Access-Control-Request-Headers',
  };
}

function json(status, payload, origin, requestedHeaders) {
  const headers = {
    'Content-Type': 'application/json',
    ...(origin ? corsHeaders(origin, requestedHeaders) : {}),
  };
  return new Response(JSON.stringify(payload), { status, headers });
}

function getTargetUrl(requestUrl) {
  const trimmedUrl = requestUrl.pathname.startsWith('/')
    ? requestUrl.pathname.slice(1) + requestUrl.search
    : requestUrl.pathname + requestUrl.search;
  if (!trimmedUrl) return null;
  try {
    return new URL(trimmedUrl);
  } catch {
    return null;
  }
}

function buildUpstreamHeaders(request, targetUrl) {
  const headers = new Headers();
  const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

  for (const [name, value] of request.headers.entries()) {
    const lower = name.toLowerCase();
    if (hopByHop.has(lower)) continue;
    if (['host', 'origin', 'referer', 'cookie', 'cookie2'].includes(lower)) continue;
    headers.set(lower, value);
  }

  headers.set('host', targetUrl.host);
  return headers;
}

export default {
  async fetch(request, env) {
    const allowedOrigins = parseCsv(env.ALLOWED_ORIGINS).length
      ? parseCsv(env.ALLOWED_ORIGINS)
      : DEFAULT_ALLOWED_ORIGINS;
    const allowedTargetHosts = parseCsv(env.ALLOWED_TARGET_HOSTS).length
      ? parseCsv(env.ALLOWED_TARGET_HOSTS)
      : DEFAULT_ALLOWED_TARGET_HOSTS;

    const origin = request.headers.get('Origin');
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === '/healthz') {
      return json(200, { ok: true }, origin, requestedHeaders);
    }

    if (!isOriginAllowed(origin, allowedOrigins)) {
      return json(403, { error: 'Origin not allowed' }, origin, requestedHeaders);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, requestedHeaders),
      });
    }

    const targetUrl = getTargetUrl(requestUrl);
    if (!targetUrl) {
      return json(400, {
        error: 'Invalid target URL',
        usage: 'Request /https://api.example.com/path',
      }, origin, requestedHeaders);
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return json(403, { error: 'Only http and https targets are allowed' }, origin, requestedHeaders);
    }

    if (!isTargetHostAllowed(targetUrl.hostname, allowedTargetHosts)) {
      return json(403, { error: 'Target host not allowed', targetHost: targetUrl.hostname }, origin, requestedHeaders);
    }

    try {
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers: buildUpstreamHeaders(request, targetUrl),
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow',
      });

      const responseHeaders = new Headers();
      upstream.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith('access-control-')) return;
        responseHeaders.set(key, value);
      });
      for (const [key, value] of Object.entries(corsHeaders(origin, requestedHeaders))) {
        responseHeaders.set(key, value);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return json(502, {
        error: 'Upstream request failed',
        detail: String(error?.message || error),
      }, origin, requestedHeaders);
    }
  },
};

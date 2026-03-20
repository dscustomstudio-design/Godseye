const ALLOWED_DOMAINS = [
  'feeds.bbci.co.uk',
  'feeds.reuters.com',
  'rss.cnn.com',
  'www.aljazeera.com',
  'feeds.nbcnews.com',
  'rsshub.app',
  'www.theguardian.com',
  'moxie.foxnews.com',
  'opensky-network.org',
  'api.weather.gov',
  'www.nhc.noaa.gov',
];

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');

  if (!target) return new Response('Missing ?url= parameter', { status: 400 });

  let parsed;
  try { parsed = new URL(target); }
  catch (e) { return new Response('Invalid URL', { status: 400 }); }

  const allowed = ALLOWED_DOMAINS.some(d =>
    parsed.hostname === d || parsed.hostname.endsWith('.' + d)
  );
  if (!allowed) return new Response('Domain not whitelisted: ' + parsed.hostname, { status: 403 });

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GodsEye/1.0)',
        'Accept': 'application/rss+xml, application/xml, application/json, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });

    const body = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (e) {
    return new Response('Fetch failed: ' + e.message, { status: 502 });
  }
}

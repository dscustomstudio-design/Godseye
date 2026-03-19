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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const target = req.query.url;
  if (!target) return res.status(400).json({ error: 'Missing ?url= parameter' });

  let parsed;
  try { parsed = new URL(target); }
  catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }

  const hostname = parsed.hostname;
  const allowed = ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  if (!allowed) return res.status(403).json({ error: 'Domain not whitelisted: ' + hostname });

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GodsEye/1.0)',
        'Accept': 'application/rss+xml, application/xml, application/json, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return res.status(response.status).json({ error: `Upstream ${response.status}` });

    const contentType = response.headers.get('content-type') || 'text/plain';
    const body = await response.text();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).send(body);
  } catch (e) {
    return res.status(502).json({ error: 'Fetch failed: ' + e.message });
  }
}

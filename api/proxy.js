export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const target = req.query.url;
  if (!target) return res.status(400).send('Missing ?url=');

  let parsed;
  try { parsed = new URL(target); }
  catch (e) { return res.status(400).send('Invalid URL'); }

  const ALLOWED = [
    'feeds.bbci.co.uk','feeds.reuters.com','rss.cnn.com',
    'www.aljazeera.com','feeds.nbcnews.com','rsshub.app',
    'www.theguardian.com','moxie.foxnews.com',
    'opensky-network.org','api.weather.gov','www.nhc.noaa.gov',
  ];

  if (!ALLOWED.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
    return res.status(403).send('Domain not whitelisted');
  }

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GodsEye/1.0)',
        'Accept': 'application/rss+xml, application/xml, application/json, text/xml, */*',
      },
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.text();
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(response.status).send(body);
  } catch (e) {
    return res.status(502).send('Fetch failed: ' + e.message);
  }
}

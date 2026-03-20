const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Serve frontend from /public
app.use(express.static(path.join(__dirname, 'public')));

// ── Whitelisted upstream domains
const ALLOWED = [
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
  'celestrak.org',
  'celestrak.com',
];

// ── PROXY  GET /proxy?url=<encoded-url>
app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing ?url= parameter');

  let parsed;
  try { parsed = new URL(target); }
  catch (e) { return res.status(400).send('Invalid URL'); }

  const allowed = ALLOWED.some(d =>
    parsed.hostname === d || parsed.hostname.endsWith('.' + d)
  );
  if (!allowed) return res.status(403).send('Domain not whitelisted: ' + parsed.hostname);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const upstream = await fetch(target, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GodsEye/1.0)',
        'Accept': 'application/rss+xml, application/xml, application/json, text/xml, */*',
      },
    });
    clearTimeout(timer);

    const body = await upstream.text();
    const ct   = upstream.headers.get('content-type') || 'text/plain';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(upstream.status).send(body);

  } catch (e) {
    console.error('[proxy]', target, e.message);
    res.status(502).send('Upstream fetch failed: ' + e.message);
  }
});

// ── Health check
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

// ── Catch-all → index.html
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.listen(PORT, () =>
  console.log(`God's Eye server on port ${PORT}`)
);

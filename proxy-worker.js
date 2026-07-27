/**
 * NYT Connections Proxy — Cloudflare Worker
 *
 * Endpoints:
 *   GET /?date=YYYY-MM-DD   → returns puzzle for that date
 *   GET /                    → returns today's puzzle (UTC date)
 *
 * Deploy: paste this entire file into the Cloudflare Workers editor
 * and click "Deploy". See DEPLOY.md for step-by-step instructions.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // ── Resolve date ────────────────────────────────────────
    const date = url.searchParams.get('date') || todayUTC();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError(400, 'Invalid date format. Use YYYY-MM-DD.');
    }

    const nytUrl = `https://www.nytimes.com/svc/connections/v2/${date}.json`;

    // ── Cloudflare edge cache ───────────────────────────────
    const cacheKey = new Request(nytUrl);
    const cache    = caches.default;
    let cached     = await cache.match(cacheKey);

    if (cached) {
      const data = await cached.text();
      return new Response(data, {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    // ── Fetch from NYT ──────────────────────────────────────
    let nytRes;
    try {
      nytRes = await fetch(nytUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
          'Accept':     'application/json, text/plain, */*',
          'Referer':    'https://www.nytimes.com/',
        },
        cf: { cacheTtl: 21600, cacheEverything: true },
      });
    } catch (err) {
      return jsonError(502, `Could not reach NYT: ${err.message}`);
    }

    if (!nytRes.ok) {
      return jsonError(nytRes.status, `NYT returned HTTP ${nytRes.status}`);
    }

    const body = await nytRes.text();

    // Validate it's actually puzzle JSON
    try {
      const parsed = JSON.parse(body);
      if (!parsed?.categories?.length) throw new Error('unexpected shape');
    } catch {
      return jsonError(502, 'NYT response was not valid puzzle JSON.');
    }

    // Store in edge cache for 6 hours
    const toCache = new Response(body, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600' },
    });
    ctx.waitUntil(cache.put(cacheKey, toCache));

    return new Response(body, {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  },
};

// ── Helpers ─────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function todayUTC() {
  const d = new Date();
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

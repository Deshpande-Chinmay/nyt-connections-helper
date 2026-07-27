# Deploy Your Own NYT Connections Proxy (Cloudflare Workers)

## Why bother?
Public CORS proxies (corsproxy.io, allorigins, etc.) are slow (1-3 seconds) and unreliable.  
Your own Cloudflare Worker sits on Cloudflare's global edge network and:
- Responds in **< 100 ms** on cache hit (most loads)
- Fetches direct from NYT with a real browser `User-Agent` on cache miss
- Caches each day's puzzle for **6 hours** at the nearest data centre to you
- Has a **100,000 free requests/day** — more than enough

---

## Step-by-step deployment (no CLI needed)

### 1. Create a free Cloudflare account
Go to → https://dash.cloudflare.com/sign-up  
(free, no credit card required)

### 2. Open Workers
In the dashboard left sidebar click **Workers & Pages** → **Create**

### 3. Create the worker
- Click **"Create Worker"**
- Give it a name e.g. `nyt-connections-proxy`
- Click **"Deploy"** (ignore the placeholder script for now)

### 4. Paste the worker script
- Click **"Edit code"**
- **Select all** the existing code and **delete it**
- Open `proxy-worker.js` from this folder and **copy its entire contents**
- Paste it into the editor
- Click **"Deploy"** (top right)

### 5. Copy your worker URL
After deploying you'll see a URL like:
```
https://nyt-connections-proxy.YOUR-USERNAME.workers.dev
```
Copy that URL.

### 6. Add it to the website
Open `app.js` and find this line near the top:

```js
const CUSTOM_PROXY_URL = '';   // ← paste your worker URL here
```

Paste your worker URL inside the quotes, e.g.:
```js
const CUSTOM_PROXY_URL = 'https://nyt-connections-proxy.yourname.workers.dev';
```

Save the file. That's it — your worker is now tried **first**, before any public proxy.

---

## Test your worker
Open this URL in a browser (replace with your actual worker URL):
```
https://nyt-connections-proxy.yourname.workers.dev
```
You should see raw JSON with today's puzzle categories.

You can also test a specific date:
```
https://nyt-connections-proxy.yourname.workers.dev/?date=2025-01-15
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Worker returns `NYT returned HTTP 403` | NYT may have changed their API URL — check the NYT Connections network tab in DevTools |
| Worker returns `NYT returned HTTP 404` | Today's puzzle may not be published yet (publishes ~midnight ET) |
| Site still uses public proxies | Make sure `CUSTOM_PROXY_URL` in `app.js` is set and the file is saved |

---

## Updating the worker
If you ever need to change the script, go back to  
**Workers & Pages → nyt-connections-proxy → Edit code** and redeploy.

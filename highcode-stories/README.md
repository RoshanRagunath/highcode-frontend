# highcode-stories

Standalone Stories app served at `stories.highcode.nl`. Deployed as a separate Cloudflare Pages project from the rest of this repo.

## Routes

- `/` — public landing page
- `/app` — upload UI
- `/history` — upload history
- `/api/ingest` — POST a file, proxied to n8n
- `/api/history` — GET history JSON, proxied to n8n

> No auth is currently wired up. Anyone who finds these URLs can hit the
> upload endpoint. The only protection between Pages and n8n is the
> shared secret env var below. Add a login gate before sharing the URL.

## Cloudflare Pages setup

1. **Create a new Pages project** in the Cloudflare dashboard. Set the build output directory to `highcode-stories/` so this folder is the deployment root.
2. **Custom domain:** add `stories.highcode.nl` and let Cloudflare provision the CNAME on the highcode.nl zone.
3. **Environment variables** on the Pages project (Production):
   - `STORIES_SHARED_SECRET` — the shared secret already used by the existing n8n webhook.
   - `N8N_BASE_URL` — optional; defaults to `https://n8n.roshanragunath.com/webhook`.

## Local development

The static pages can be served via the repo's `serve.mjs`:

```
node serve.mjs
# then visit http://localhost:3000/highcode-stories/index.html
```

Pages Functions do not run under `serve.mjs`. To exercise them locally use `wrangler pages dev`:

```
npx wrangler pages dev highcode-stories
```

## What lives where

```
highcode-stories/
  index.html                landing page
  app/                      upload UI
    index.html
    app.js
    styles.css
  history/                  full history view
    index.html
    history.js
  functions/
    api/
      ingest.js             proxy POST to n8n /stories/ingest
      history.js            proxy GET to n8n /stories/history
  _redirects                redirect rules
  README.md
```

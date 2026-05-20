# User Stories Uploader — frontend bundle

Drop-in files for the `RoshanRagunath/highcode-frontend` Cloudflare Pages repo. Mounts at `highcode.nl/userstories`.

## Files

```
userstories/
  index.html        # drag-drop page
  app.js            # client logic (DOCX→MD via mammoth.js)
  styles.css        # minimal styling

functions/userstories/api/
  ingest.js         # Pages Function: POST proxy → n8n /stories/ingest
  history.js        # Pages Function: GET  proxy → n8n /stories/history
```

## Copy these into the highcode-frontend repo

Preserve the directory layout exactly. The `functions/` folder is what Cloudflare Pages uses for routes:

- `https://highcode.nl/userstories/` → serves `userstories/index.html`
- `https://highcode.nl/userstories/api/ingest` → runs `functions/userstories/api/ingest.js`
- `https://highcode.nl/userstories/api/history` → runs `functions/userstories/api/history.js`

The Pages Functions inject the shared secret server-side, so the browser never sees it and CORS preflight isn't a concern (browser only talks to same-origin).

## Cloudflare Pages env vars

In Pages → highcode-frontend → Settings → Variables and Secrets, add:

| Name | Value | Type |
|---|---|---|
| `STORIES_SHARED_SECRET` | (the token already shared in chat) | **Secret** |
| `N8N_BASE_URL` | `https://n8n.roshanragunath.com/webhook` | Plaintext (optional — that's the default) |

For initial testing against an inactive workflow, set `N8N_BASE_URL` to `https://n8n.roshanragunath.com/webhook-test` so it hits the test endpoint. Flip back to `/webhook` once the workflows are activated.

## n8n side (already created)

- Workflow `[Stories] Ingest & Create Jira Issues` — id `FHYAkLWKjVIxEIfC` (POST `/webhook/stories/ingest`)
- Workflow `[Stories] Get Upload History` — id `j7EWFU8yErBdG63S` (GET `/webhook/stories/history`)
- DataTable `stories_upload_history` — id `YE02HoVxaSBr8kie`
- httpHeaderAuth credential `Stories Webhook Secret` — id `nTq2Nov0JyUryJyS` (header `x-stories-secret`, value already set)

Authentication is enforced at the **webhook node level** via the credential above. Bad/missing headers are rejected by n8n before any other node runs. No n8n Variables or server env vars required.

Both workflows are created `active: false`. Activate manually after a test run.

## Supported file types

- **PDF** — extracted via n8n's Extract from File node
- **Markdown** (`.md`, `.markdown`) — decoded in n8n
- **DOCX** — converted to plain text **in the browser** via [mammoth.js](https://github.com/mwilliamson/mammoth.js) before upload, then handled as markdown by n8n

Max file size: **10 MB**, enforced client-side.

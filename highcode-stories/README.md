# highcode-stories

Standalone Stories app served at `stories.highcode.nl`. Deployed as a separate Cloudflare Pages project from the rest of this repo.

## Routes

- `/` — public landing page
- `/app` — upload UI (login required)
- `/history` — upload history (login required)
- `/account` — view/edit your own Jira project key (login required)
- `/admin` — manage users and their Jira project keys (admin role required)
- `/api/ingest` — POST a file, proxied to n8n with the user's `x-project-key`
- `/api/history` — GET history JSON, proxied to n8n with the user's `x-project-key`
- `/api/me` — GET current user / POST to change your own Jira key
- `/api/admin/users` — admin CRUD for the user → Jira key mapping

## Auth model

- **Cloudflare Access** (Zero Trust, free tier) gates `/app*`, `/history*`,
  `/admin*`, `/account*` and `/api*` at the edge. Users sign in with an
  email one-time code; the policy restricts who may enter (e.g. @fizor.com).
- **D1 database `stories-users`** maps each verified email to a name, Jira
  project key and role (`user`/`admin`). No passwords are stored anywhere.
- `functions/_middleware.js` independently verifies the Access JWT
  (`Cf-Access-Jwt-Assertion`) against the team's public keys, then injects
  the user's `jira_key` server-side into the n8n proxy calls. A client can
  never choose its own project key.
- Users authenticated by Access but not yet in the D1 table can sign in but
  see "no project assigned" and cannot upload until an admin adds them on `/admin`.

## Cloudflare setup (one-time)

1. **Pages project**: build output directory `highcode-stories/`, custom
   domain `stories.highcode.nl` (already in place).
2. **D1**: `npx wrangler d1 create stories-users`, then apply
   `../highcode-stories-db/0001_init.sql` and `0002_seed_admin.sql` with
   `--remote`. Bind it to the Pages project as `DB`
   (Settings → Functions → D1 database bindings).
3. **Zero Trust / Access**: enable Zero Trust, pick a team domain. Create a
   self-hosted Access application for `stories.highcode.nl` with paths
   `/app*`, `/history*`, `/admin*`, `/account*`, `/api*`; policy: allow
   emails ending `@fizor.com`; login method: email one-time PIN. Note the
   app's AUD tag.
4. **Environment variables** on the Pages project (Production):
   - `STORIES_SHARED_SECRET` — shared secret for the n8n webhooks.
   - `N8N_BASE_URL` — optional; defaults to `https://n8n.roshanragunath.com/webhook`.
   - `ACCESS_TEAM_DOMAIN` — e.g. `highcode.cloudflareaccess.com`.
   - `ACCESS_AUD` — the Access application AUD tag.

The n8n ingest workflow reads `x-project-key` (fallback `RN`) and
`x-user-email` from the request headers; the history webhook filters by them.

## Local development

Functions + D1 need wrangler (`serve.mjs` only serves static files). A
git-ignored local `wrangler.toml` provides the D1 binding for dev. First time:

```
npx wrangler d1 execute stories-users --local --file=../highcode-stories-db/0001_init.sql
npx wrangler d1 execute stories-users --local --file=../highcode-stories-db/0002_seed_admin.sql
```

Then run (from this directory):

```
npx wrangler pages dev --port 8788 \
  --d1 DB=00000000-0000-0000-0000-000000000001 \
  --binding STORIES_SHARED_SECRET=devsecret \
  --binding DEV_BYPASS_EMAIL=roshan.ragunath@fizor.com
```

`DEV_BYPASS_EMAIL` skips Access JWT verification for localhost requests and
signs you in as that email — change it to test other roles/unmapped users.
Never set it in the Pages dashboard.

## What lives where

```
highcode-stories/
  index.html                landing page (public)
  app/                      upload UI
    index.html
    app.js
    user-nav.js             shared signed-in nav strip (fetches /api/me)
    styles.css              shared softlight stylesheet
  history/                  full history view
    index.html
    history.js
  account/                  own Jira key + identity
    index.html
    account.js
  admin/                    user management (admin only)
    index.html
    admin.js
  functions/
    _middleware.js          Access JWT check, role gates, user lookup
    _lib/access.js          JWT verification + shared helpers
    api/
      me.js                 GET current user / POST own jira_key
      ingest.js             proxy POST to n8n /stories/ingest (+x-project-key)
      history.js            proxy GET to n8n /stories/history (+x-project-key)
      admin/users/          admin CRUD endpoints
  _redirects                redirect rules
  README.md

../highcode-stories-db/     D1 schema + seed (outside the deploy dir)
```

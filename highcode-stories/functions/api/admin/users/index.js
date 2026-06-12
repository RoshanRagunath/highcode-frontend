import { json, validJiraKey, validEmail } from '../../../_lib/access.js';

export async function onRequestGet(context) {
  const { results } = await context.env.DB
    .prepare('SELECT id, email, name, jira_key, role, created_at FROM users ORDER BY created_at')
    .all();
  return json({ users: results });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const key = String(body.jira_key || '').trim().toUpperCase();
  const role = body.role === 'admin' ? 'admin' : 'user';

  if (!validEmail(email)) return json({ error: 'invalid_email' }, 400);
  if (!validJiraKey(key)) {
    return json({ error: 'invalid_jira_key', message: 'Project key must be 2-10 characters, letters and digits, starting with a letter (e.g. RN).' }, 400);
  }

  try {
    const row = await env.DB
      .prepare('INSERT INTO users (email, name, jira_key, role) VALUES (?, ?, ?, ?) RETURNING id, email, name, jira_key, role, created_at')
      .bind(email, name, key, role)
      .first();
    return json({ ok: true, user: row }, 201);
  } catch (err) {
    if (String(err && err.message || err).includes('UNIQUE')) {
      return json({ error: 'duplicate_email' }, 409);
    }
    throw err;
  }
}

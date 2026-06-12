import { json, validJiraKey } from '../_lib/access.js';

export async function onRequestGet(context) {
  const u = context.data.user;
  return json({
    email: u.email,
    name: u.name,
    jira_key: u.jira_key,
    role: u.role,
    unmapped: !!u.unmapped
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const u = context.data.user;

  if (u.unmapped) {
    return json({ error: 'no_project_assigned', message: 'Ask an admin to assign you a Jira project first.' }, 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const key = String(body.jira_key || '').trim().toUpperCase();
  if (!validJiraKey(key)) {
    return json({ error: 'invalid_jira_key', message: 'Project key must be 2-10 characters, letters and digits, starting with a letter (e.g. RN).' }, 400);
  }

  await env.DB.prepare('UPDATE users SET jira_key = ? WHERE id = ?').bind(key, u.id).run();
  return json({ ok: true, jira_key: key });
}

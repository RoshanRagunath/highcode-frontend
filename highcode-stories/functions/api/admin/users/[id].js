import { json, validJiraKey } from '../../../_lib/access.js';

async function loadTarget(env, params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return env.DB
    .prepare('SELECT id, email, name, jira_key, role FROM users WHERE id = ?')
    .bind(id)
    .first();
}

async function adminCount(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first();
  return row.n;
}

export async function onRequestPatch(context) {
  const { env, request, params } = context;

  const target = await loadTarget(env, params);
  if (!target) return json({ error: 'not_found' }, 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const updates = { name: target.name, jira_key: target.jira_key, role: target.role };

  if (body.name !== undefined) updates.name = String(body.name).trim();

  if (body.jira_key !== undefined) {
    const key = String(body.jira_key).trim().toUpperCase();
    if (!validJiraKey(key)) {
      return json({ error: 'invalid_jira_key', message: 'Project key must be 2-10 characters, letters and digits, starting with a letter (e.g. RN).' }, 400);
    }
    updates.jira_key = key;
  }

  if (body.role !== undefined) {
    const role = body.role === 'admin' ? 'admin' : 'user';
    if (target.role === 'admin' && role !== 'admin' && (await adminCount(env)) <= 1) {
      return json({ error: 'last_admin', message: 'Cannot demote the last admin.' }, 400);
    }
    updates.role = role;
  }

  const row = await env.DB
    .prepare('UPDATE users SET name = ?, jira_key = ?, role = ? WHERE id = ? RETURNING id, email, name, jira_key, role, created_at')
    .bind(updates.name, updates.jira_key, updates.role, target.id)
    .first();
  return json({ ok: true, user: row });
}

export async function onRequestDelete(context) {
  const { env, params } = context;

  const target = await loadTarget(env, params);
  if (!target) return json({ error: 'not_found' }, 404);

  if (target.id === context.data.user.id) {
    return json({ error: 'cannot_delete_self' }, 400);
  }
  if (target.role === 'admin' && (await adminCount(env)) <= 1) {
    return json({ error: 'last_admin', message: 'Cannot delete the last admin.' }, 400);
  }

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(target.id).run();
  return json({ ok: true });
}

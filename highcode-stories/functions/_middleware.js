import { verifyAccessJwt, getUser, json } from './_lib/access.js';

const PROTECTED_PREFIXES = ['/app', '/history', '/admin', '/account', '/api'];

function isProtected(path) {
  return PROTECTED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (!isProtected(path)) return next();

  const isApi = path.startsWith('/api');

  // Access blocks unauthenticated traffic at the edge; this is defense-in-depth.
  const identity = await verifyAccessJwt(request, env);
  if (!identity) {
    return isApi
      ? json({ error: 'unauthorized' }, 401)
      : new Response('Not authorized. Sign in via Cloudflare Access.', { status: 403 });
  }

  if (!env.DB) {
    return json({ error: 'server_misconfigured', message: 'D1 binding DB not configured.' }, 500);
  }

  const user = await getUser(env.DB, identity.email);

  if (!user) {
    // Authenticated via Access but not mapped to a Jira project yet.
    const unmapped = { id: null, email: identity.email, name: '', jira_key: null, role: 'user', unmapped: true };
    const allowed =
      (request.method === 'GET' && !isApi && !path.startsWith('/admin')) ||
      path === '/api/me';
    if (!allowed) {
      return isApi
        ? json({ error: 'no_project_assigned' }, 403)
        : Response.redirect(url.origin + '/app/', 302);
    }
    context.data.user = unmapped;
    return next();
  }

  if ((path.startsWith('/admin') || path.startsWith('/api/admin')) && user.role !== 'admin') {
    return isApi
      ? json({ error: 'forbidden' }, 403)
      : Response.redirect(url.origin + '/app/', 302);
  }

  // CSRF hygiene: state-changing JSON APIs must send the JSON content type
  // (the multipart upload endpoint is the only exception).
  if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && path !== '/api/ingest') {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return json({ error: 'unsupported_content_type' }, 415);
    }
  }

  context.data.user = user;
  return next();
}

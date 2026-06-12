export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STORIES_SHARED_SECRET) {
    return jsonResponse({ error: 'server_misconfigured', message: 'STORIES_SHARED_SECRET not set in Pages env vars.' }, 500);
  }

  const n8nBase = env.N8N_BASE_URL || 'https://n8n.roshanragunath.com/webhook';
  const target = n8nBase.replace(/\/$/, '') + '/stories/ingest';

  const contentType = request.headers.get('content-type') || 'application/octet-stream';
  const body = await request.arrayBuffer();

  let upstream;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'x-stories-secret': env.STORIES_SHARED_SECRET,
        'content-type': contentType,
        'x-project-key': context.data.user.jira_key,
        'x-user-email': context.data.user.email
      },
      body
    });
  } catch (err) {
    return jsonResponse({ error: 'upstream_unreachable', message: String(err && err.message || err) }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' }
  });
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: { 'content-type': 'application/json' }
  });
}

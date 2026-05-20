export async function onRequestGet(context) {
  const { env } = context;

  if (!env.STORIES_SHARED_SECRET) {
    return jsonResponse({ error: 'server_misconfigured', message: 'STORIES_SHARED_SECRET not set in Pages env vars.' }, 500);
  }

  const n8nBase = env.N8N_BASE_URL || 'https://n8n.roshanragunath.com/webhook';
  const target = n8nBase.replace(/\/$/, '') + '/stories/history';

  let upstream;
  try {
    upstream = await fetch(target, {
      method: 'GET',
      headers: { 'x-stories-secret': env.STORIES_SHARED_SECRET }
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

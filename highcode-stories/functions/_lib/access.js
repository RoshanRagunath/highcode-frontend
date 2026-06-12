// Shared auth helpers for Cloudflare Access. No onRequest* exports, so Pages
// generates no route for this file.

let jwksCache = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000;

function b64urlToUint8(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtPart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToUint8(part)));
}

async function getJwks(teamDomain) {
  const now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch('https://' + teamDomain + '/cdn-cgi/access/certs');
  if (!res.ok) throw new Error('jwks_fetch_failed: HTTP ' + res.status);
  const data = await res.json();
  jwksCache = { keys: data.keys || [], fetchedAt: now };
  return jwksCache.keys;
}

// Verifies the Cf-Access-Jwt-Assertion JWT. Returns { email } or null.
export async function verifyAccessJwt(request, env) {
  // Local dev bypass: only when the binding is set on the wrangler dev command
  // line AND the request is to localhost. Never set DEV_BYPASS_EMAIL in prod.
  if (env.DEV_BYPASS_EMAIL) {
    const host = new URL(request.url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return { email: String(env.DEV_BYPASS_EMAIL).toLowerCase() };
    }
  }

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  let token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    const cookie = request.headers.get('Cookie') || '';
    const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
    if (m) token = m[1];
  }
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header, payload;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
  if (payload.iss !== 'https://' + env.ACCESS_TEAM_DOMAIN) return null;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (!payload.email) return null;

  let keys;
  try {
    keys = await getJwks(env.ACCESS_TEAM_DOMAIN);
  } catch {
    return null;
  }
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) {
    // Key rotation: refetch once.
    jwksCache = { keys: null, fetchedAt: 0 };
    try {
      keys = await getJwks(env.ACCESS_TEAM_DOMAIN);
    } catch {
      return null;
    }
    jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return null;
  }

  try {
    const key = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', key,
      b64urlToUint8(parts[2]),
      new TextEncoder().encode(parts[0] + '.' + parts[1])
    );
    if (!valid) return null;
  } catch {
    return null;
  }

  return { email: String(payload.email).toLowerCase() };
}

export async function getUser(db, email) {
  return db
    .prepare('SELECT id, email, name, jira_key, role FROM users WHERE email = ?')
    .bind(email)
    .first();
}

export function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status || 200,
    headers: { 'content-type': 'application/json' }
  });
}

export function validJiraKey(k) {
  return /^[A-Z][A-Z0-9]{1,9}$/.test(k);
}

export function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

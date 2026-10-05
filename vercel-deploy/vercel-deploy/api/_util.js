export async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}
// Allow only calls coming from this site's own pages (blocks casual hot-linking of the proxy).
export function sameOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const src = req.headers.origin || req.headers.referer || '';
  if (!src) return false;
  try { return new URL(src).host === host; } catch { return false; }
}
export function serverToken(clientAuth) {
  const t = String(clientAuth || '').replace(/^Bearer\s+/i, '').trim();
  if (!t || t === 'server-token') return { token: process.env.NOTION_TOKEN || '', fromServer: true };
  return { token: t, fromServer: false };
}

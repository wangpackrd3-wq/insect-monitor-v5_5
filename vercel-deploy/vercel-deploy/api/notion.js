import { readRaw, sameOrigin, serverToken } from './_util.js';
const ID = '[0-9a-fA-F-]{32,36}';
function norm(id) { return String(id || '').replace(/-/g, '').toLowerCase(); }
// The app may hold the data-source (collection) id; Notion API 2022-06-28 needs the database id.
function fixIds(s) {
  const alias = norm(process.env.NOTION_DB_ALIAS), db = norm(process.env.NOTION_DB_ID);
  if (!alias || !db) return s;
  const dashed = alias.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  return s.split(alias).join(db).split(dashed).join(db);
}
export default async function handler(req, res) {
  if (!sameOrigin(req)) return res.status(403).json({ message: 'forbidden' });
  const path = fixIds(String(req.query.path || ''));
  if (!/^[\w\-\/?=&.]+$/.test(path) || path.includes('..')) return res.status(400).json({ message: 'bad path' });
  const { token, fromServer } = serverToken(req.headers.authorization);
  if (!token) return res.status(500).json({ message: 'ยังไม่ได้ตั้งค่า NOTION_TOKEN ใน Vercel' });
  let raw = ['GET', 'HEAD'].includes(req.method) ? null : await readRaw(req);
  if (raw && raw.length) raw = Buffer.from(fixIds(raw.toString('utf8')), 'utf8');
  if (fromServer) {
    // With the server's own token, allow only what the app needs, on its own database.
    const db = norm(process.env.NOTION_DB_ID);
    const p = path.split('?')[0];
    let ok = false;
    if (req.method === 'GET' && p === 'users/me') ok = true;
    const m = p.match(new RegExp('^(databases|blocks)/(' + ID + ')(/children)?$'));
    if (m && db && norm(m[2]) === db && (req.method === 'GET' || (req.method === 'PATCH' && m[1] === 'databases' && !m[3]))) ok = true;
    if (req.method === 'POST' && p === 'pages') {
      try { const b = JSON.parse(raw.toString('utf8')); ok = !!db && norm(b?.parent?.database_id) === db; } catch { ok = false; }
    }
    if (!ok) return res.status(403).json({ message: 'ไม่อนุญาตให้ใช้ token ของเซิร์ฟเวอร์กับคำสั่งนี้' });
  }
  try {
    const headers = { Authorization: 'Bearer ' + token, 'Notion-Version': req.headers['notion-version'] || '2022-06-28' };
    if (raw && raw.length) headers['Content-Type'] = 'application/json';
    const r = await fetch('https://api.notion.com/v1/' + path, { method: req.method, headers, body: raw && raw.length ? raw : undefined });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ message: e.message });
  }
}

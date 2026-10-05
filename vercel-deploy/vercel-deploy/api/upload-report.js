import { readRaw, sameOrigin, serverToken } from './_util.js';
// Upload the monthly HTML report to Notion (File Upload API) and return an id the app attaches to the row.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ url: null, error: 'Method not allowed' });
  if (!sameOrigin(req)) return res.status(403).json({ url: null, error: 'forbidden' });
  const { token } = serverToken(req.headers['x-notion-token']);
  if (!token) return res.status(500).json({ url: null, error: 'ยังไม่ได้ตั้งค่า NOTION_TOKEN ใน Vercel' });
  let name = 'report.html';
  try { name = decodeURIComponent(req.headers['x-filename'] || name).replace(/[\/\\:*?"<>|]/g, '_'); } catch {}
  const H = { Authorization: 'Bearer ' + token, 'Notion-Version': '2022-06-28' };
  try {
    const html = await readRaw(req);
    for (const [ct, fn] of [['text/html', name], ['text/plain', name.replace(/\.html?$/i, '') + '.txt']]) {
      const c = await fetch('https://api.notion.com/v1/file_uploads', {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single_part', filename: fn, content_type: ct }),
      });
      const cj = await c.json().catch(() => ({}));
      if (!c.ok) { if (ct === 'text/html') continue; return res.status(200).json({ url: null, error: cj.message || 'create upload failed' }); }
      const fd = new FormData();
      fd.append('file', new Blob([html], { type: ct }), fn);
      const s = await fetch(`https://api.notion.com/v1/file_uploads/${cj.id}/send`, { method: 'POST', headers: H, body: fd });
      const sj = await s.json().catch(() => ({}));
      if (s.ok) return res.status(200).json({ url: 'notion-upload:' + cj.id });
      if (ct === 'text/plain') return res.status(200).json({ url: null, error: sj.message || 'send failed' });
    }
    return res.status(200).json({ url: null, error: 'upload failed' });
  } catch (e) {
    return res.status(200).json({ url: null, error: e.message });
  }
}

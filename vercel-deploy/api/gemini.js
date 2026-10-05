import { readRaw, sameOrigin } from './_util.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Vercel' });
  const model = String(req.query.model || 'gemini-3.5-flash-lite');
  if (!/^gemini-[\w.\-]+$/.test(model)) return res.status(400).json({ error: 'bad model' });
  try {
    const body = await readRaw(req);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

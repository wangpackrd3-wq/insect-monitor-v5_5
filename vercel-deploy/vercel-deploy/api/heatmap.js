import { put, list, del } from '@vercel/blob';
import { readRaw, sameOrigin } from './_util.js';

// Shared heat-map layout. Every save writes a new file heatmap/state-<time>.json;
// the newest file is the current layout, its pathname is the "version".
const PREFIX = 'heatmap/state-';
const KEEP = 30; // keep the last 30 saves as history

async function allVersions() {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix: PREFIX, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => (a.pathname < b.pathname ? 1 : -1)); // newest first
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const v = await allVersions();
      if (!v.length) return res.status(200).json({ version: null, state: {}, savedAt: null });
      const r = await fetch(v[0].url, { cache: 'no-store' });
      const j = await r.json();
      return res.status(200).json({ version: v[0].pathname, state: j.state || {}, savedAt: j.savedAt || null });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });

    const raw = await readRaw(req);
    if (raw.length > 2_000_000) return res.status(413).json({ error: 'ผังใหญ่เกินไป' });
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'bad json' }); }

    const pw = process.env.HEATMAP_EDIT_PASSWORD || '';
    if (!pw || String(body.password || '') !== pw) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    if (body.check) return res.status(200).json({ ok: true });

    const st = body.state;
    if (!st || typeof st !== 'object' || Array.isArray(st)) return res.status(400).json({ error: 'bad state' });

    const v = await allVersions();
    const current = v.length ? v[0].pathname : null;
    if (!body.force && (body.baseVersion || null) !== current) {
      return res.status(409).json({ error: 'มีคนบันทึกผังใหม่ไปก่อนแล้ว', version: current });
    }
    const savedAt = new Date().toISOString();
    const pathname = PREFIX + Date.now() + '.json';
    await put(pathname, JSON.stringify({ state: st, savedAt }), {
      access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60,
    });
    const old = v.slice(KEEP - 1).map(b => b.url);
    if (old.length) await del(old).catch(() => {});
    return res.status(200).json({ ok: true, version: pathname, savedAt });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

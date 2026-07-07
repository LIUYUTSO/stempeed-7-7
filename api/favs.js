import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'db-not-configured' });
    const sql = neon(process.env.DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS stampede_favs(
      device_id text PRIMARY KEY,
      ev_ids jsonb NOT NULL DEFAULT '[]',
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    const device = String(req.query.device || '').slice(0, 64);
    if (!device) return res.status(400).json({ error: 'device-required' });

    if (req.method === 'GET') {
      const rows = await sql`SELECT ev_ids FROM stampede_favs WHERE device_id=${device}`;
      return res.status(200).json({ favs: rows[0]?.ev_ids ?? [] });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const favs = Array.isArray(body.favs)
        ? body.favs.filter(n => Number.isInteger(n) && n >= 0 && n < 1000).slice(0, 300)
        : [];
      await sql`INSERT INTO stampede_favs(device_id, ev_ids, updated_at)
        VALUES(${device}, ${JSON.stringify(favs)}::jsonb, now())
        ON CONFLICT(device_id) DO UPDATE SET ev_ids=${JSON.stringify(favs)}::jsonb, updated_at=now()`;
      return res.status(200).json({ ok: true, count: favs.length });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method-not-allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}

import { neon } from '@neondatabase/serverless';

const NAMES = ['Aiden', 'Becky', 'Grace', 'Adam'];

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'db-not-configured' });
    const sql = neon(process.env.DATABASE_URL);
    await sql`CREATE TABLE IF NOT EXISTS stampede_locs(
      name text PRIMARY KEY,
      lat double precision NOT NULL,
      lng double precision NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT name, lat, lng, EXTRACT(EPOCH FROM (now()-updated_at))::int AS age_s
        FROM stampede_locs
        WHERE updated_at > now() - interval '3 hours'`;
      return res.status(200).json({ locs: rows });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = NAMES.includes(body.name) ? body.name : null;
      const lat = Number(body.lat), lng = Number(body.lng);
      if (!name) return res.status(400).json({ error: 'invalid-name' });
      if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
          lat < 50.9 || lat > 51.2 || lng < -114.3 || lng > -113.8)
        return res.status(400).json({ error: 'out-of-range' });
      await sql`INSERT INTO stampede_locs(name, lat, lng, updated_at)
        VALUES(${name}, ${lat}, ${lng}, now())
        ON CONFLICT(name) DO UPDATE SET lat=${lat}, lng=${lng}, updated_at=now()`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method-not-allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}

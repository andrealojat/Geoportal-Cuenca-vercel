export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const view = req.query.v;
  const limit = Math.min(parseInt(req.query.limit) || 1000, 1000);
  const offset = parseInt(req.query.offset) || 0;

  if (!view) return res.status(400).json({ error: "Missing view parameter (?v=...)" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: "Server config missing" });

  try {
    const url = `${SUPABASE_URL}/rest/v1/${view}?select=*&limit=${limit}&offset=${offset}`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: "application/json",
      },
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  let connectivity = "not_tested";
  let error = null;

  if (url && key) {
    try {
      const r = await fetch(`${url}/rest/v1/v_limite_cuenca_geojson?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      });
      const text = await r.text();
      connectivity = r.ok ? "ok" : `HTTP ${r.status}`;
      error = r.ok ? null : text.substring(0, 200);
    } catch (e) {
      connectivity = "fetch_error";
      error = e.message;
    }
  }

  res.status(200).json({
    env: {
      SUPABASE_URL: url ? "SET (length " + url.length + ")" : "MISSING",
      SUPABASE_KEY: key ? "SET (length " + key.length + ")" : "MISSING",
    },
    connectivity,
    error,
    node: process.version,
  });
}

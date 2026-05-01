// api/uv.ts
export default async function handler(req: any, res: any) {
  const { lat, lon } = req.query;
  try {
    const query = new URLSearchParams({ 
      latitude: String(lat), 
      longitude: String(lon), 
      daily: 'uv_index_max', 
      timezone: 'auto', 
      forecast_days: '1' 
    }).toString();
    const url = `https://api.open-meteo.com/v1/forecast?${query}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'UV Error', message: error.message });
  }
}

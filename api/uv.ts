// api/uv.ts
export default async function handler(req: any, res: any) {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing coordinates', message: 'lat and lon are required' });
  }

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
    
    // Check if the response is actually JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error('UV Provider Error - Not JSON:', text.substring(0, 200));
      return res.status(502).json({ 
        error: 'Upstream Error', 
        message: 'The UV data provider returned an unexpected response format.' 
      });
    }

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('UV Function Error:', error.message);
    return res.status(500).json({ error: 'UV Error', message: error.message || 'Internal Server Error' });
  }
}

// api/forecast.ts
export default async function handler(req: any, res: any) {
  const { city, lat, lon, units = 'metric' } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY?.replace(/[\r\n\t]/g, '').trim().replace(/['"`]/g, '').trim();

  if (!apiKey || apiKey === 'undefined' || apiKey.length < 10) {
    return res.status(500).json({ error: 'Config Error: API Key missing' });
  }

  try {
    const params: any = { appid: apiKey, units };
    if (lat && lon) {
      params.lat = String(lat);
      params.lon = String(lon);
    } else if (city) {
      params.q = String(city);
    }

    const query = new URLSearchParams(params).toString();
    const url = `https://api.openweathermap.org/data/2.5/forecast?${query}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'Forecast Error', message: error.message });
  }
}
